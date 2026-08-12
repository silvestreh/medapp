import { listOrganizationSlugs } from '~/api.server';

/**
 * Guards organization lookups against subdomain scanners.
 *
 * `*.<BOOKING_HOST_SUFFIX>` is a wildcard record, so every hostname anyone
 * invents reaches this app and its first label is taken as an organization
 * slug. Without a gate each probe becomes a `get-organization` call on the API,
 * which throws a 400/404 and spends the shared `/patient-otp` rate-limit budget
 * that real patients need.
 */

// Mirrors `isValidSlug` in apps/api/src/services/patient-otp/patient-otp.class.ts.
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MIN_SLUG_LENGTH = 2;
const MAX_SLUG_LENGTH = 63;

// Labels that resolve through the wildcard but can never name an organization.
// The cached slug list below already rejects them; this is the floor that still
// holds when the list is unavailable or truncated.
const RESERVED_LABELS = new Set([
  'admin', 'api', 'app', 'assets', 'autoconfig', 'autodiscover', 'beta', 'cdn',
  'ci', 'cpanel', 'database', 'db', 'demo', 'dev', 'docs', 'download',
  'downloads', 'files', 'ftp', 'git', 'grafana', 'imap', 'img', 'images',
  'jenkins', 'kibana', 'local', 'localhost', 'mail', 'media', 'metrics',
  'monitor', 'mx', 'ns', 'ns1', 'ns2', 'pop', 'preview', 'proxy', 'redis',
  'sandbox', 'smtp', 'stage', 'staging', 'static', 'status', 'test', 'vpn',
  'webdisk', 'webmail', 'whm', 'www',
]);

// Short enough that a newly created organization starts working quickly, long
// enough that a scanner sweep costs one list call rather than one per probe.
const CACHE_TTL_MS = 60_000;

type SlugCache = {
  slugs: Set<string>;
  /** False when the API's page limit may have truncated the list. */
  complete: boolean;
  fetchedAt: number;
};

let cache: SlugCache | null = null;
let inFlight: Promise<SlugCache | null> | null = null;

async function fetchSlugs(): Promise<SlugCache | null> {
  try {
    const { slugs, complete } = await listOrganizationSlugs();
    return { slugs: new Set(slugs), complete, fetchedAt: Date.now() };
  } catch {
    // The API is the authority; if we can't reach it, fall through to the
    // per-slug lookup rather than turning real organizations away.
    return null;
  }
}

function getFreshCache(): SlugCache | null {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return cache;
  return null;
}

function refreshCache(): Promise<SlugCache | null> {
  // Single-flight: a burst of probes must not trigger one fetch per probe.
  if (!inFlight) {
    inFlight = fetchSlugs()
      .then(next => {
        if (next) cache = next;
        return next;
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

/**
 * Whether `slug` could name an organization, answered without touching the API
 * whenever possible.
 *
 * Errs towards `true`: an unreachable or truncated slug list falls back to the
 * per-slug lookup, so a real organization is never turned away. A newly created
 * organization can 404 for up to `CACHE_TTL_MS`.
 */
export async function couldBeOrganization(slug: string): Promise<boolean> {
  if (slug.length < MIN_SLUG_LENGTH || slug.length > MAX_SLUG_LENGTH) return false;
  if (!SLUG_RE.test(slug)) return false;
  if (RESERVED_LABELS.has(slug)) return false;

  const known = getFreshCache() ?? await refreshCache();
  if (!known || !known.complete) return true;

  return known.slugs.has(slug);
}
