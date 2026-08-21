import { Hook, HookContext } from '@feathersjs/feathers';
import { BadRequest, Conflict } from '@feathersjs/errors';

// DNS label rules: lowercase alphanumerics and hyphens, no leading/trailing hyphen, max 63 chars.
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MIN_LENGTH = 2;
const MAX_LENGTH = 63;

// Slugs that would collide with our own subdomains or shadow booking app routes.
// MUST be a superset of RESERVED_LABELS in
// apps/booking/app/organizations.server.ts — a label the booking app refuses
// to resolve but this hook allows produces an organization whose booking link
// can never work (that drift is how an org got saved as "demo").
const RESERVED_SLUGS = new Set([
  // Mirror of the booking app's RESERVED_LABELS:
  'admin', 'api', 'app', 'assets', 'autoconfig', 'autodiscover', 'beta', 'cdn',
  'ci', 'cpanel', 'database', 'db', 'demo', 'dev', 'docs', 'download',
  'downloads', 'files', 'ftp', 'git', 'grafana', 'imap', 'img', 'images',
  'jenkins', 'kibana', 'local', 'localhost', 'mail', 'media', 'metrics',
  'monitor', 'mx', 'ns', 'ns1', 'ns2', 'pop', 'preview', 'proxy', 'redis',
  'sandbox', 'smtp', 'stage', 'staging', 'static', 'status', 'test', 'vpn',
  'webdisk', 'webmail', 'whm', 'www',
  // API-side extras: our own service subdomains and booking-app route segments.
  'ui', 'booking', 'chat', 'site', 'help', 'support', 'portal', 'dashboard',
  'login', 'signup', 'auth', 'logout', 'new-appointment', 'appointment',
]);

const validateSlug = (): Hook => async (context: HookContext): Promise<HookContext> => {
  if (context.data?.slug === undefined) return context;

  const slug = String(context.data.slug).trim().toLowerCase();
  context.data.slug = slug;

  if (slug.length < MIN_LENGTH || slug.length > MAX_LENGTH || !SLUG_RE.test(slug)) {
    throw new BadRequest('Invalid slug format', { errors: { slug: 'invalid' } });
  }

  if (RESERVED_SLUGS.has(slug)) {
    throw new BadRequest('This slug is reserved', { errors: { slug: 'reserved' } });
  }

  const existing = await context.app.service('organizations').find({
    query: { slug, $limit: 1 },
    paginate: false,
  });
  const match = (Array.isArray(existing) ? existing : [existing]).find(
    (org: { id: string }) => org && org.id !== context.id
  );
  if (match) {
    throw new Conflict('Slug already in use', { errors: { slug: 'taken' } });
  }

  return context;
};

export default validateSlug;
