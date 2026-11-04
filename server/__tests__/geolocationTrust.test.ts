import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('../analyticsService', () => ({ analyticsService: { trackGeoBlock: vi.fn(), track: vi.fn() } }));

import { geolocationService } from '../geolocation';

const fakeReq = (ip: string | undefined, headers: Record<string, string> = {}) =>
  ({ ip, headers, socket: { remoteAddress: '10.9.9.9' } }) as any;

describe('geolocationService.getUserIP', () => {
  it('uses req.ip and ignores client-supplied forwarding headers', () => {
    const req = fakeReq('203.0.113.7', { 'x-forwarded-for': '1.2.3.4', 'x-real-ip': '5.6.7.8', 'cf-connecting-ip': '9.9.9.9' });
    expect(geolocationService.getUserIP(req)).toBe('203.0.113.7');
  });

  it('falls back to the socket address', () => {
    expect(geolocationService.getUserIP(fakeReq(undefined))).toBe('10.9.9.9');
  });
});

describe('geolocationService.checkRegion', () => {
  afterEach(() => vi.restoreAllMocks());

  it('fails closed when the lookup throws', async () => {
    vi.spyOn(geolocationService, 'getCountryCode').mockRejectedValue(new Error('lookup down'));
    const result = await geolocationService.checkRegion(fakeReq('203.0.113.7'));
    expect(result.allowed).toBe(false);
  });

  it('does not trust a spoofed cf-ipcountry header', async () => {
    const spy = vi.spyOn(geolocationService, 'getCountryCode');
    spy.mockResolvedValue({ country: 'FR', ip: '203.0.113.7', source: 'api' });
    const result = await geolocationService.checkRegion(fakeReq('203.0.113.7', { 'cf-ipcountry': 'US' }));
    expect(result.allowed).toBe(false);
  });
});
