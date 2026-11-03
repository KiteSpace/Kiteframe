import { describe, it, expect } from 'vitest';
import { isPrivateIp, parsePublicUrl } from '../lib/safeFetch';

describe('isPrivateIp', () => {
  it.each([
    '127.0.0.1', '10.0.0.5', '172.16.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0',
    '::1', '::', 'fe80::1', 'fd00::1', '::ffff:127.0.0.1', '::ffff:7f00:1', '[::1]',
  ])('blocks %s', (ip) => expect(isPrivateIp(ip)).toBe(true));

  it.each(['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111'])('allows %s', (ip) => expect(isPrivateIp(ip)).toBe(false));
});

describe('parsePublicUrl', () => {
  it.each([
    'file:///etc/passwd', 'gopher://x', 'http://[::1]:80/', 'http://169.254.169.254/', 'http://2130706433/',
    'http://localhost:5000', 'http://foo.internal', 'http://user:pw@example.com',
  ])('rejects %s', (url) => expect(() => parsePublicUrl(url)).toThrow());

  it('accepts public https URLs', () => {
    expect(parsePublicUrl('https://example.com/a').hostname).toBe('example.com');
  });
});
