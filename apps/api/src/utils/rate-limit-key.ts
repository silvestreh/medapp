import type { Request } from 'express';
import { ipKeyGenerator } from 'express-rate-limit';

/**
 * Rate-limit key for endpoints that are reached through the booking/UI proxies.
 *
 * Those proxies call the API over Railway's private network, so `req.ip` is the
 * proxy's own address and is identical for every request they relay — which
 * collapses every user into a single shared bucket. The proxies forward the
 * address they observed as `x-client-ip`; trust it only when the request also
 * carries the proxy secret, since otherwise any caller could set it and sidestep
 * the limit entirely.
 *
 * Falls back to `req.ip` for direct callers.
 */
export function clientIpKey(req: Request): string {
  const proxySecret = process.env.PROXY_SECRET;
  const proxyToken = req.headers['x-proxy-token'];

  if (proxySecret && proxyToken === proxySecret) {
    const forwarded = req.headers['x-client-ip'];
    const clientIp = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.trim();
    if (clientIp) {
      return ipKeyGenerator(clientIp);
    }
  }

  return ipKeyGenerator(req.ip ?? '');
}
