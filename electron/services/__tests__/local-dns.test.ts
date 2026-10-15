import assert from 'node:assert/strict';
import { createSocket } from 'node:dgram';
import { once } from 'node:events';
import test from 'node:test';
import * as dnsPacket from 'dns-packet';
import {
  buildLocalDnsResponse,
  buildNoDataResponse,
  buildServerFailureResponse,
  isDomainMatch,
  LocalDnsServer,
  parseDnsQuery,
} from '../local-dns.js';

const DOMAIN = 'alifshohojprint.example.com';
const LOCAL_IP = '192.168.0.150';

const encodeQuery = (name: string, type: 'A' | 'AAAA', id = 0x1234): Buffer =>
  dnsPacket.encode({
    type: 'query',
    id,
    flags: dnsPacket.RECURSION_DESIRED,
    questions: [{ type, name }],
  });

const answerData = (response: Buffer): unknown =>
  (dnsPacket.decode(response).answers?.[0] as { data?: unknown } | undefined)?.data;

test('the local domain matches itself and its subdomains only', () => {
  assert.equal(isDomainMatch(DOMAIN, DOMAIN), true);
  assert.equal(isDomainMatch(`${DOMAIN}.`, DOMAIN), true);
  assert.equal(isDomainMatch(`Shop.${DOMAIN.toUpperCase()}`, DOMAIN), true);
  assert.equal(isDomainMatch(`ctr1.${DOMAIN}`, DOMAIN), true);
  assert.equal(isDomainMatch('example.com', DOMAIN), false);
  assert.equal(isDomainMatch('evil-alifshohojprint.example.com.attacker.net', DOMAIN), false);
  assert.equal(isDomainMatch(DOMAIN, ''), false);
});

test('only well-formed queries are parsed', () => {
  const parsed = parseDnsQuery(encodeQuery(DOMAIN, 'A'));
  assert.equal(parsed?.question.name, DOMAIN);
  assert.equal(parsed?.question.type, 'A');
  assert.equal(parsed?.question.recordClass, 'IN');

  assert.equal(parseDnsQuery(Buffer.from([1, 2, 3])), null);
  const response = dnsPacket.encode({
    type: 'response',
    id: 1,
    questions: [{ type: 'A', name: DOMAIN }],
    answers: [],
  });
  assert.equal(parseDnsQuery(response), null, 'a response must never be treated as a query');
});

test('an A query for the local domain answers with the LAN address', () => {
  const response = buildLocalDnsResponse(encodeQuery(DOMAIN, 'A'), { domain: DOMAIN, localAddress: LOCAL_IP });
  assert.ok(response);
  const decoded = dnsPacket.decode(response);
  assert.equal(decoded.type, 'response');
  assert.equal(decoded.rcode, 'NOERROR');
  assert.equal(decoded.questions?.[0]?.name, DOMAIN);
  assert.equal(answerData(response), LOCAL_IP);
});

test('the TTL is kept short so a changed LAN address propagates quickly', () => {
  const response = buildLocalDnsResponse(encodeQuery(DOMAIN, 'A'), {
    domain: DOMAIN,
    localAddress: LOCAL_IP,
    ttlSeconds: 5,
  });
  assert.ok(response);
  assert.equal((dnsPacket.decode(response).answers?.[0] as { ttl?: number }).ttl, 5);
});

test('a local resolver without a usable address does not answer the local domain', () => {
  const response = buildLocalDnsResponse(encodeQuery(DOMAIN, 'A'), {
    domain: DOMAIN,
    localAddress: '127.0.0.1',
  });
  assert.ok(response, 'loopback is still a valid answer for a single-PC check');
  assert.equal(answerData(response), '127.0.0.1');
});

test('AAAA and other record types get an empty NOERROR so the browser falls back to A', () => {
  const response = buildLocalDnsResponse(encodeQuery(DOMAIN, 'AAAA'), { domain: DOMAIN, localAddress: LOCAL_IP });
  assert.ok(response);
  const decoded = dnsPacket.decode(response);
  assert.equal(decoded.type, 'response');
  assert.equal(decoded.rcode, 'NOERROR');
  assert.equal(decoded.answers?.length, 0);
  assert.equal(decoded.questions?.[0]?.name, DOMAIN);
});

test('queries for other domains are left for the upstream resolver', () => {
  assert.equal(buildLocalDnsResponse(encodeQuery('google.com', 'A'), { domain: DOMAIN, localAddress: LOCAL_IP }), null);
});

test('error responses preserve the query id and set the requested rcode', () => {
  const query = encodeQuery(DOMAIN, 'A', 0xbeef);
  assert.equal(dnsPacket.decode(buildNoDataResponse(query)).rcode, 'NOERROR');
  const failure = dnsPacket.decode(buildServerFailureResponse(query));
  assert.equal(failure.rcode, 'SERVFAIL');
  assert.equal(failure.id, 0xbeef);
});

test('the UDP server answers a real A query with the LAN address', async () => {
  const server = new LocalDnsServer({
    domain: DOMAIN,
    resolveLocalAddress: () => LOCAL_IP,
    port: 0,
    host: '127.0.0.1',
    upstreams: [],
  });
  const listening = Promise.withResolvers<void>();
  server.listen();
  server.onListening(() => listening.resolve());
  await listening.promise;

  const bound = server.address();
  assert.ok(bound && bound.port > 0, 'the server should expose its bound port');

  const client = createSocket('udp4');
  try {
    const received = once(client, 'message');
    client.send(encodeQuery(DOMAIN, 'A'), bound.port, '127.0.0.1');
    const [response] = (await received) as [Buffer, unknown];
    assert.equal(answerData(response), LOCAL_IP);
  } finally {
    client.close();
    server.close();
  }
});

test('the UDP server leaves other domains to the upstream resolver', async () => {
  const server = new LocalDnsServer({
    domain: DOMAIN,
    resolveLocalAddress: () => LOCAL_IP,
    port: 0,
    host: '127.0.0.1',
    upstreams: ['127.0.0.1'],
  });
  const listening = Promise.withResolvers<void>();
  server.listen();
  server.onListening(() => listening.resolve());
  await listening.promise;
  const bound = server.address();
  assert.ok(bound);

  const client = createSocket('udp4');
  try {
    const received = once(client, 'message');
    client.send(encodeQuery('google.com', 'A'), bound.port, '127.0.0.1');
    const [response] = (await received) as [Buffer, unknown];
    // 127.0.0.1 refuses the upstream connection, so the last resort is SERVFAIL.
    assert.equal(dnsPacket.decode(response).rcode, 'SERVFAIL');
  } finally {
    client.close();
    server.close();
  }
});
