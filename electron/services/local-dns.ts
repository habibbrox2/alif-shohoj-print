import { createSocket, type RemoteInfo, type Socket } from 'node:dgram';
import * as dnsPacket from 'dns-packet';
import { isPrivateIpv4 } from './network-utils.js';

export const DNS_DEFAULT_PORT = 53;
export const DNS_DEFAULT_TTL_SECONDS = 15;
const UPSTREAM_TIMEOUT_MS = 2000;
const HEADER_BYTES = 12;
const FLAG_RESPONSE = 0x8000;
const FLAG_RECURSION_AVAILABLE = 0x0080;
const RCODE_MASK = 0x000f;
const RCODE_NO_ERROR = 0;
const RCODE_SERVER_FAILURE = 2;

export interface ParsedDnsQuestion {
  name: string;
  type: string;
  recordClass: string;
}

export interface ParsedDnsQuery {
  id: number;
  question: ParsedDnsQuestion;
}

export interface LocalDnsResponseOptions {
  domain: string;
  localAddress: string;
  ttlSeconds?: number;
}

export interface LocalDnsServerOptions {
  /** Exact domain or parent domain the LAN should divert, e.g. `shop.example.com`. */
  domain: string;
  /** Resolved on every query so a network change is picked up without a restart. */
  resolveLocalAddress: () => string;
  port?: number;
  host?: string;
  upstreams?: string[];
  ttlSeconds?: number;
  onError?: (error: Error) => void;
  /**
   * When this returns false the query is forwarded upstream even for the local
   * domain, so a phone whose internet works can keep using the cloud path.
   */
  shouldServeLocally?: () => boolean;
}

export const normalizeDnsName = (name: string): string =>
  name.trim().toLowerCase().replace(/\.+$/, '');

export const isDomainMatch = (queryName: string, domain: string): boolean => {
  const normalizedQuery = normalizeDnsName(queryName);
  const normalizedDomain = normalizeDnsName(domain);
  if (!normalizedQuery || !normalizedDomain) return false;
  return normalizedQuery === normalizedDomain || normalizedQuery.endsWith(`.${normalizedDomain}`);
};

export const parseDnsQuery = (message: Buffer): ParsedDnsQuery | null => {
  if (message.length < HEADER_BYTES) return null;
  let decoded: dnsPacket.DecodedPacket;
  try {
    decoded = dnsPacket.decode(message);
  } catch {
    return null;
  }
  if (decoded.type !== 'query' || typeof decoded.id !== 'number') return null;
  const question = decoded.questions?.[0];
  if (!question || typeof question.name !== 'string') return null;
  return {
    id: decoded.id,
    question: {
      name: normalizeDnsName(question.name),
      type: String(question.type),
      recordClass: String(question.class ?? 'IN'),
    },
  };
};

/** Loopback is accepted too, so a single PC can verify its own resolver. */
const isAnswerableAddress = (address: string): boolean =>
  address === '127.0.0.1' || isPrivateIpv4(address);

// A valid LAN client is a private host or this machine; anything else is left
// unanswered so the listener never becomes an open resolver for a routed network.
const isLocalClient = (address: string): boolean =>
  address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1' || isPrivateIpv4(address);

const echoResponse = (message: Buffer, rcode: number): Buffer => {
  const response = Buffer.from(message);
  const flags = (message.readUInt16BE(2) | FLAG_RESPONSE | FLAG_RECURSION_AVAILABLE) & ~RCODE_MASK;
  response.writeUInt16BE(flags | (rcode & RCODE_MASK), 2);
  return response;
};

export const buildNoDataResponse = (message: Buffer): Buffer => echoResponse(message, RCODE_NO_ERROR);

export const buildServerFailureResponse = (message: Buffer): Buffer =>
  echoResponse(message, RCODE_SERVER_FAILURE);

/**
 * Returns the response for a locally hosted domain, or null when the query must
 * be forwarded upstream. Only A/IN gets an answer: AAAA and HTTPS/SVCB records
 * have no LAN meaning and are answered with an empty NOERROR so the browser
 * falls back to the A record instead of waiting on an unreachable upstream.
 */
export const buildLocalDnsResponse = (message: Buffer, options: LocalDnsResponseOptions): Buffer | null => {
  const parsed = parseDnsQuery(message);
  if (!parsed || !isDomainMatch(parsed.question.name, options.domain)) return null;

  const wantsAddress = parsed.question.type === 'A' && parsed.question.recordClass === 'IN';
  if (wantsAddress && isAnswerableAddress(options.localAddress)) {
    return dnsPacket.encode({
      type: 'response',
      id: parsed.id,
      flags: dnsPacket.RECURSION_DESIRED | dnsPacket.RECURSION_AVAILABLE,
      questions: [{ type: 'A', class: 'IN', name: parsed.question.name }],
      answers: [
        {
          type: 'A',
          class: 'IN',
          name: parsed.question.name,
          ttl: options.ttlSeconds ?? DNS_DEFAULT_TTL_SECONDS,
          data: options.localAddress,
        },
      ],
    });
  }

  return buildNoDataResponse(message);
};

export class LocalDnsServer {
  private socket: Socket | null = null;
  private readonly upstreams: string[];

  constructor(private readonly options: LocalDnsServerOptions) {
    this.upstreams = options.upstreams?.length ? options.upstreams : ['8.8.8.8', '1.1.1.1'];
  }

  listen(): void {
    const socket = createSocket({ type: 'udp4', reuseAddr: false });
    this.socket = socket;
    socket.on('message', (message, rinfo) => this.handleQuery(message, rinfo));
    socket.on('error', error => this.options.onError?.(error));
    socket.bind(this.options.port ?? DNS_DEFAULT_PORT, this.options.host ?? '0.0.0.0');
  }

  close(): void {
    if (!this.socket) return;
    this.socket.removeAllListeners();
    this.socket.close();
    this.socket = null;
  }

  onListening(callback: () => void): void {
    this.socket?.once('listening', callback);
  }

  address(): { address: string; port: number } | null {
    if (!this.socket) return null;
    try {
      const info = this.socket.address();
      return { address: info.address, port: info.port };
    } catch {
      return null;
    }
  }

  private handleQuery(message: Buffer, rinfo: RemoteInfo): void {
    if (!isLocalClient(rinfo.address)) return;
    if (this.options.shouldServeLocally?.() ?? true) {
      const response = buildLocalDnsResponse(message, {
        domain: this.options.domain,
        localAddress: this.options.resolveLocalAddress(),
        ttlSeconds: this.options.ttlSeconds,
      });
      if (response) {
        this.send(response, rinfo);
        return;
      }
    }
    this.forward(message, rinfo);
  }

  private send(payload: Buffer, rinfo: RemoteInfo): void {
    this.socket?.send(payload, rinfo.port, rinfo.address);
  }

  private forward(message: Buffer, rinfo: RemoteInfo, upstreamIndex = 0): void {
    const upstream = this.upstreams[upstreamIndex];
    if (!upstream) {
      if (message.length >= HEADER_BYTES) this.send(buildServerFailureResponse(message), rinfo);
      return;
    }

    const socket = createSocket('udp4');
    let settled = false;
    let timer: NodeJS.Timeout | null = null;
    const queryId = message.length >= 2 ? message.readUInt16BE(0) : -1;

    const finish = (payload: Buffer | null): void => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      socket.removeAllListeners();
      socket.close();
      if (payload) this.send(payload, rinfo);
      else this.forward(message, rinfo, upstreamIndex + 1);
    };

    timer = setTimeout(() => finish(null), UPSTREAM_TIMEOUT_MS);
    socket.on('message', reply => {
      // Drop stray replies so a spoofed datagram cannot be relayed back.
      if (reply.length < HEADER_BYTES || reply.readUInt16BE(0) !== queryId) return;
      finish(reply);
    });
    socket.on('error', () => finish(null));

    try {
      socket.send(message, DNS_DEFAULT_PORT, upstream);
    } catch {
      finish(null);
    }
  }
}
