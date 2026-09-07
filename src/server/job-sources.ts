import { isIP } from 'node:net';
import { lookup } from 'node:dns/promises';
import { randomUUID } from 'node:crypto';
import { get } from 'node:https';
import { z } from 'zod';
import type { JobRecord } from '../shared/types.js';

const MAX_FEED_BYTES = 2 * 1024 * 1024;
const feedJobSchema = z.object({
  id: z.string().trim().min(1).max(200).optional(),
  title: z.string().trim().min(1).max(200),
  company: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(50_000),
  location: z.string().trim().max(200).default('未注明'),
  remote: z.boolean().default(false),
  salaryMin: z.number().nonnegative().optional(),
  salaryMax: z.number().nonnegative().optional(),
  currency: z.string().trim().max(10).optional(),
  skills: z.array(z.string().trim().min(1).max(80)).max(100).default([]),
  requiredSkills: z.array(z.string().trim().min(1).max(80)).max(100).default([]),
  applyEmail: z.string().email().optional(),
  url: z.string().url(),
  active: z.boolean().default(true),
});

export async function importJsonFeed(rawUrl: string): Promise<JobRecord[]> {
  let currentUrl = rawUrl;
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    const response = await downloadFeed(currentUrl);
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.location;
      if (!location) throw new Error('岗位 Feed 重定向缺少 Location');
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }
    if (response.status < 200 || response.status >= 300) throw new Error(`岗位 Feed 返回 HTTP ${response.status}`);
    const parsed: unknown = JSON.parse(response.body.toString('utf8'));
    const items = z.array(feedJobSchema).max(1_000).parse(Array.isArray(parsed) ? parsed : (parsed as { jobs?: unknown }).jobs);
    const importedAt = new Date().toISOString();
    return items.map((item) => ({ ...item, id: item.id ?? randomUUID(), source: currentUrl, importedAt }));
  }
  throw new Error('岗位 Feed 重定向次数超过限制');
}

/** Rejects URLs that could expose services on the host's protected networks. */
export async function assertSafeFeedUrl(rawUrl: string): Promise<string> {
  return (await resolveSafeFeedUrl(rawUrl)).url.toString();
}

async function resolveSafeFeedUrl(rawUrl: string): Promise<{ url: URL; address: string; family: 4 | 6 }> {
  const url = new URL(rawUrl);
  if (url.protocol !== 'https:') throw new Error('岗位 Feed 仅支持 HTTPS');
  if (url.username || url.password) throw new Error('岗位 Feed URL 不能包含认证信息');
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) throw new Error('岗位 Feed 不能访问本机');
  const addresses = isIP(hostname) ? [{ address: hostname }] : await lookup(hostname, { all: true });
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error('岗位 Feed 不能访问私有或本地网络');
  }
  const selected = addresses[0];
  return { url, address: selected.address, family: isIP(selected.address) as 4 | 6 };
}

async function downloadFeed(rawUrl: string): Promise<{ status: number; location?: string; body: Buffer }> {
  const target = await resolveSafeFeedUrl(rawUrl);
  return new Promise((resolve, reject) => {
    const request = get(target.url, {
      headers: { accept: 'application/json', 'accept-encoding': 'identity' },
      lookup: (_hostname, _options, callback) => callback(null, target.address, target.family),
    }, (response) => {
      const contentLength = Number(response.headers['content-length'] ?? 0);
      if (contentLength > MAX_FEED_BYTES) {
        response.destroy(new Error('岗位 Feed 超过 2 MB'));
        return;
      }
      const chunks: Buffer[] = [];
      let received = 0;
      response.on('data', (chunk: Buffer) => {
        received += chunk.length;
        if (received > MAX_FEED_BYTES) response.destroy(new Error('岗位 Feed 超过 2 MB'));
        else chunks.push(chunk);
      });
      response.on('end', () => resolve({
        status: response.statusCode ?? 500,
        location: response.headers.location,
        body: Buffer.concat(chunks),
      }));
      response.on('error', reject);
    });
    request.setTimeout(8_000, () => request.destroy(new Error('岗位 Feed 请求超时')));
    request.on('error', reject);
  });
}

function isPrivateAddress(address: string): boolean {
  const normalized = address.toLowerCase();
  if (normalized === '::1' || normalized === '::' || normalized.startsWith('fe80:') || normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  const ipv4 = mapped ?? (isIP(normalized) === 4 ? normalized : undefined);
  if (!ipv4) return false;
  const [a, b] = ipv4.split('.').map(Number);
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
}
