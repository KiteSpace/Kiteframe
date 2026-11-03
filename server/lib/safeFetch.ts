import dns from 'dns';
import http from 'http';
import https from 'https';
import net from 'net';

/** Returns true if the address is loopback, private, link-local, CGNAT, multicast or otherwise reserved. */
export function isPrivateIp(rawIp: string): boolean {
  const ip = rawIp.replace(/^\[|\]$/g, '').toLowerCase();
  const version = net.isIP(ip);
  if (version === 4) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  if (version === 6) {
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(ip);
    if (mapped) return isPrivateIp(mapped[1]);
    const mappedHex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(ip);
    if (mappedHex) {
      const hi = parseInt(mappedHex[1], 16);
      const lo = parseInt(mappedHex[2], 16);
      return isPrivateIp(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
    }
    return (
      ip === '::' || ip === '::1' ||
      ip.startsWith('fc') || ip.startsWith('fd') ||
      ip.startsWith('fe8') || ip.startsWith('fe9') || ip.startsWith('fea') || ip.startsWith('feb') ||
      ip.startsWith('ff') || ip.startsWith('64:ff9b:') || ip.startsWith('100::') || ip.startsWith('2001:db8')
    );
  }
  return true;
}

export class UnsafeUrlError extends Error {}

/** Parses the URL and rejects non-http(s) schemes and private IP literals. Hostnames are checked at connect time. */
export function parsePublicUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new UnsafeUrlError('Invalid URL format');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new UnsafeUrlError('Only HTTP/HTTPS URLs are supported');
  }
  if (parsed.username || parsed.password) {
    throw new UnsafeUrlError('URLs with credentials are not allowed');
  }
  const host = parsed.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host) && isPrivateIp(host)) {
    throw new UnsafeUrlError('Private network addresses are not allowed');
  }
  if (/^localhost$|\.localhost$|\.local$|\.internal$/i.test(host)) {
    throw new UnsafeUrlError('Private network addresses are not allowed');
  }
  return parsed;
}

/** Resolves and validates every address so the socket can only connect to public IPs (blocks DNS rebinding). */
const publicOnlyLookup: net.LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, '', 0);
    const list = addresses as dns.LookupAddress[];
    if (!list.length || list.some((a) => isPrivateIp(a.address))) {
      return callback(new UnsafeUrlError('URL resolves to a private/reserved address'), '', 0);
    }
    if ((options as any)?.all) return (callback as any)(null, list);
    callback(null, list[0].address, list[0].family);
  });
};

export interface SafeFetchOptions {
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
}

export interface SafeFetchResponse {
  status: number;
  ok: boolean;
  url: string;
  headers: Record<string, string>;
  body: Buffer;
  text(): string;
  json(): any;
}

function requestOnce(url: URL, opts: SafeFetchOptions, deadline: number): Promise<SafeFetchResponse> {
  const maxBytes = opts.maxBytes ?? 5 * 1024 * 1024;
  const transport = url.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    const req = transport.request(
      url,
      {
        method: opts.method ?? 'GET',
        headers: opts.headers,
        lookup: publicOnlyLookup,
        timeout: Math.max(1, deadline - Date.now()),
      },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        res.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > maxBytes) {
            req.destroy(new UnsafeUrlError(`Response exceeds ${maxBytes} bytes`));
            return;
          }
          chunks.push(chunk);
        });
        res.on('end', () => {
          const body = Buffer.concat(chunks);
          const headers: Record<string, string> = {};
          for (const [k, v] of Object.entries(res.headers)) {
            if (v !== undefined) headers[k] = Array.isArray(v) ? v.join(', ') : v;
          }
          const status = res.statusCode ?? 0;
          resolve({
            status,
            ok: status >= 200 && status < 300,
            url: url.href,
            headers,
            body,
            text: () => body.toString('utf-8'),
            json: () => JSON.parse(body.toString('utf-8')),
          });
        });
        res.on('error', reject);
      },
    );
    req.on('timeout', () => req.destroy(new Error('Request timed out')));
    req.on('error', reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

/**
 * Server-side fetch for user-supplied URLs: http(s) only, public IPs only (checked at connect time,
 * so DNS rebinding can't bypass it), redirects followed manually with each hop re-validated,
 * bounded response size and total timeout.
 */
export async function safeFetch(rawUrl: string, opts: SafeFetchOptions = {}): Promise<SafeFetchResponse> {
  const maxRedirects = opts.maxRedirects ?? 3;
  const deadline = Date.now() + (opts.timeoutMs ?? 10000);
  let current = parsePublicUrl(rawUrl);
  let method = opts.method ?? 'GET';
  let body = opts.body;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const res = await requestOnce(current, { ...opts, method, body }, deadline);
    if (res.status >= 300 && res.status < 400 && res.headers.location) {
      current = parsePublicUrl(new URL(res.headers.location, current).href);
      if (res.status === 303 || ((res.status === 301 || res.status === 302) && method === 'POST')) {
        method = 'GET';
        body = undefined;
      }
      continue;
    }
    return res;
  }
  throw new UnsafeUrlError('Too many redirects');
}
