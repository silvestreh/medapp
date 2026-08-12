import { redirect } from '@remix-run/node';

export type BookingContext = {
  /** Organization slug, or null when the request has no org context (e.g. legacy host root). */
  slug: string | null;
  /** '' in subdomain mode, `/${slug}` in path mode. Prefix for all in-app links/redirects. */
  basePath: string;
};

export function getRequestHost(request: Request): string {
  const raw = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? '';
  return raw.split(',')[0].trim().split(':')[0].toLowerCase();
}

/**
 * The address this request came from, forwarded to the API so its rate limiters
 * key on the real caller. Without it every booking request shares one bucket,
 * because the API only ever sees this app's private-network address.
 *
 * Cloudflare sets `cf-connecting-ip` authoritatively; the left-most
 * `x-forwarded-for` entry is the fallback.
 */
export function getClientIp(request: Request): string | null {
  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  if (cfConnectingIp) return cfConnectingIp.trim();

  const forwardedFor = request.headers.get('x-forwarded-for');
  return forwardedFor?.split(',')[0].trim() || null;
}

function getHostSuffix(): string {
  return (process.env.BOOKING_HOST_SUFFIX || '').toLowerCase();
}

function getLegacyHosts(): string[] {
  return (process.env.BOOKING_LEGACY_HOSTS || '')
    .toLowerCase()
    .split(',')
    .map(h => h.trim())
    .filter(Boolean);
}

export function getSubdomainSlug(request: Request): string | null {
  const suffix = getHostSuffix();
  if (!suffix) return null;

  const host = getRequestHost(request);
  if (!host.endsWith(`.${suffix}`)) return null;

  const sub = host.slice(0, -(suffix.length + 1));
  // Only first-level labels ("felix", not "a.b") map to an organization.
  if (!sub || sub.includes('.')) return null;
  return sub;
}

/**
 * Resolves the organization slug and link base path for a request.
 * Must be called at the top of every loader and action.
 *
 * Throws 301 redirects for:
 * - subdomain requests that still carry the slug path segment (canonicalization)
 * - legacy hosts (BOOKING_LEGACY_HOSTS) pointing at the canonical subdomain
 */
export function resolveBookingContext(request: Request, params: { slug?: string }): BookingContext {
  const subdomainSlug = getSubdomainSlug(request);

  if (subdomainSlug) {
    if (params.slug) {
      // e.g. https://felix.athelas.cloud/felix/auth -> https://felix.athelas.cloud/auth
      const url = new URL(request.url);
      const rest = url.pathname.slice(`/${params.slug}`.length) || '/';
      throw redirect(`${rest}${url.search}`, 301);
    }
    return { slug: subdomainSlug, basePath: '' };
  }

  const suffix = getHostSuffix();
  if (suffix && params.slug && getLegacyHosts().includes(getRequestHost(request))) {
    const url = new URL(request.url);
    const rest = url.pathname.slice(`/${params.slug}`.length) || '/';
    throw redirect(`https://${params.slug}.${suffix}${rest}${url.search}`, 301);
  }

  if (params.slug) {
    return { slug: params.slug, basePath: `/${params.slug}` };
  }

  return { slug: null, basePath: '' };
}
