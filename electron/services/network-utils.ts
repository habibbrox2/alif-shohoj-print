import { networkInterfaces } from 'node:os';
import type { NetworkInterfaceInfo } from 'node:os';

export interface LanIpv4Address {
  interfaceName: string;
  address: string;
}

/**
 * A print-shop PC usually carries VirtualBox/Hyper-V/WSL/Docker adapters that
 * also hold private addresses. Handing one of those to a customer phone would
 * point the QR flow at a host the phone cannot reach, so they are excluded.
 */
const VIRTUAL_INTERFACE_PATTERNS: RegExp[] = [
  /^veth/i,
  /^docker/i,
  /^br-/i,
  /^vmnet/i,
  /^vmware/i,
  /^virtualbox/i,
  /^vbox/i,
  /^vethernet/i,
  /^hyper-v/i,
  /^wsl/i,
  /^loopback/i,
  /^tap/i,
  /^tun\d*$/i,
  /^tailscale/i,
  /^zt[a-z0-9]+/i,
  /^npcap/i,
  /^bluetooth/i,
  /^teredo/i,
  /^isatap/i,
];

/** Adapter names Windows and Linux give to the real Wi-Fi or Ethernet NIC. */
const PHYSICAL_INTERFACE_PATTERNS: RegExp[] = [
  /^wi-?fi/i,
  /^wlan/i,
  /^wireless/i,
  /^ethernet/i,
  /^eth\d*/i,
  /^en[a-z0-9]+/i,
  /^local area connection/i,
  /^realtek/i,
  /^intel/i,
];

export const isVirtualInterfaceName = (name: string): boolean =>
  VIRTUAL_INTERFACE_PATTERNS.some(pattern => pattern.test(name.trim()));

export const isPrivateIpv4 = (address: string): boolean => {
  const octets = address.split('.').map(part => Number(part));
  if (octets.length !== 4) return false;
  if (octets.some(octet => !Number.isInteger(octet) || octet < 0 || octet > 255)) return false;
  const [first, second] = octets;
  if (first === 10) return true;
  if (first === 172 && second >= 16 && second <= 31) return true;
  return first === 192 && second === 168;
};

const scoreAddress = (entry: LanIpv4Address): number => {
  let score = 0;
  if (PHYSICAL_INTERFACE_PATTERNS.some(pattern => pattern.test(entry.interfaceName.trim()))) score += 2;
  if (entry.address.startsWith('192.168.')) score += 1;
  return score;
};

/**
 * Returns every usable private IPv4 address, best candidate first. Injecting
 * `interfaces` keeps the selection logic unit-testable without touching the
 * host machine's real adapters.
 */
export const listLanIpv4Addresses = (
  interfaces: NodeJS.Dict<NetworkInterfaceInfo[] | undefined> = networkInterfaces(),
): LanIpv4Address[] => {
  const addresses: LanIpv4Address[] = [];
  for (const [interfaceName, entries] of Object.entries(interfaces)) {
    if (!entries || isVirtualInterfaceName(interfaceName)) continue;
    for (const entry of entries) {
      if (entry.family !== 'IPv4' || entry.internal || !isPrivateIpv4(entry.address)) continue;
      addresses.push({ interfaceName, address: entry.address });
    }
  }
  return addresses.sort((a, b) => scoreAddress(b) - scoreAddress(a));
};

export const resolveLanIpv4Address = (
  interfaces: NodeJS.Dict<NetworkInterfaceInfo[] | undefined> = networkInterfaces(),
): string => listLanIpv4Addresses(interfaces)[0]?.address ?? '127.0.0.1';
