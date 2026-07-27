import { Hook, HookContext } from '@feathersjs/feathers';
import { BadRequest, Conflict } from '@feathersjs/errors';

// DNS label rules: lowercase alphanumerics and hyphens, no leading/trailing hyphen, max 63 chars.
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MIN_LENGTH = 2;
const MAX_LENGTH = 63;

// Slugs that would collide with our own subdomains or shadow booking app routes.
const RESERVED_SLUGS = new Set([
  'www', 'api', 'app', 'ui', 'booking', 'chat', 'site', 'mail', 'smtp', 'imap',
  'admin', 'staging', 'dev', 'test', 'status', 'docs', 'help', 'support',
  'cdn', 'assets', 'static', 'portal', 'dashboard', 'login', 'signup', 'ns1', 'ns2',
  'auth', 'logout', 'new-appointment',
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
