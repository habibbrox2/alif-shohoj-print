import assert from 'node:assert/strict';
import type { NetworkInterfaceInfo } from 'node:os';
import test from 'node:test';
import {
  isPrivateIpv4,
  isVirtualInterfaceName,
  listLanIpv4Addresses,
  resolveLanIpv4Address,
} from '../network-utils.js';

const nic = (address: string, overrides: Partial<NetworkInterfaceInfo> = {}): NetworkInterfaceInfo => ({
  address,
  netmask: '255.255.255.0',
  family: 'IPv4',
  mac: '00:00:00:00:00:00',
  internal: false,
  cidr: `${address}/24`,
  ...overrides,
});

test('only RFC 1918 private IPv4 addresses are accepted for LAN sharing', () => {
  for (const address of ['192.168.0.100', '10.0.0.5', '172.16.0.1', '172.31.255.254']) {
    assert.equal(isPrivateIpv4(address), true, `${address} should be private`);
  }
  for (const address of ['172.15.0.1', '172.32.0.1', '8.8.8.8', '127.0.0.1', '169.254.10.20', '192.168.0.256', '192.168.0', 'not-an-ip']) {
    assert.equal(isPrivateIpv4(address), false, `${address} should not be private`);
  }
});

test('virtual and tunnel adapters are recognised by name', () => {
  for (const name of [
    'vEthernet (WSL)',
    'VirtualBox Host-Only Network',
    'Docker Desktop',
    'Hyper-V Virtual Ethernet Adapter',
    'VMware Network Adapter VMnet1',
    'Loopback Pseudo-Interface 1',
    'Tailscale',
  ]) {
    assert.equal(isVirtualInterfaceName(name), true, `${name} should be treated as virtual`);
  }
  for (const name of ['Wi-Fi', 'Ethernet', 'WLAN', 'en0']) {
    assert.equal(isVirtualInterfaceName(name), false, `${name} should be treated as physical`);
  }
});

test('listLanIpv4Addresses drops virtual, non-private and internal adapters', () => {
  const addresses = listLanIpv4Addresses({
    'Wi-Fi': [nic('192.168.0.150')],
    Ethernet: [nic('10.0.0.5')],
    'vEthernet (WSL)': [nic('172.20.0.1')],
    'VirtualBox Host-Only Network': [nic('192.168.56.1')],
    'Loopback Pseudo-Interface 1': [nic('127.0.0.1', { internal: true })],
    'Public Adapter': [nic('8.8.8.8')],
  });

  assert.deepEqual(addresses, [
    { interfaceName: 'Wi-Fi', address: '192.168.0.150' },
    { interfaceName: 'Ethernet', address: '10.0.0.5' },
  ]);
});

test('the physical Wi-Fi or Ethernet adapter wins over an unknown private adapter', () => {
  const addresses = listLanIpv4Addresses({
    'Some Adapter': [nic('192.168.1.5')],
    'Wi-Fi': [nic('192.168.9.9', { family: 'IPv4' })],
  });

  assert.equal(addresses[0]?.interfaceName, 'Wi-Fi');
});

test('every private address of one adapter is reported', () => {
  const addresses = listLanIpv4Addresses({
    Ethernet: [nic('192.168.0.20'), nic('10.10.10.10')],
  });

  assert.deepEqual(addresses.map(entry => entry.address), ['192.168.0.20', '10.10.10.10']);
});

test('resolveLanIpv4Address falls back to loopback when no LAN adapter is present', () => {
  assert.equal(resolveLanIpv4Address({}), '127.0.0.1');
  assert.equal(
    resolveLanIpv4Address({ 'vEthernet (WSL)': [nic('172.20.0.1')], 'Wi-Fi': [nic('192.168.0.42')] }),
    '192.168.0.42',
  );
});
