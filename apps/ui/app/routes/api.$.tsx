import type { LoaderFunctionArgs, ActionFunctionArgs } from '@remix-run/node';

const API_URL = () => process.env.API_URL ?? 'http://localhost:3030';
const PROXY_SECRET = process.env.PROXY_SECRET || '';

// x-signature / x-request-id carry the Mercado Pago webhook HMAC — the API is
// never public, so provider webhooks arrive through this proxy and verification
// breaks without them.
const FORWARDED_HEADERS = ['content-type', 'authorization', 'accept', 'organization-id', 'x-signature', 'x-request-id'];

/**
 * The API sees this proxy's private-network address on every relayed request,
 * so its rate limiters need the address we observed to key on. Cloudflare sets
 * `cf-connecting-ip` authoritatively; the left-most `x-forwarded-for` entry is
 * the fallback (client-settable, but no worse than one shared bucket for all).
 */
function getClientIp(request: Request): string | null {
  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  if (cfConnectingIp) return cfConnectingIp.trim();

  const forwardedFor = request.headers.get('x-forwarded-for');
  return forwardedFor?.split(',')[0].trim() || null;
}

// Allowlist of valid first-segment API paths. Requests not matching are
// rejected with 404 before reaching the backend.
const ALLOWED_PATHS = new Set([
  'authentication',
  'users',
  'appointments',
  'patients',
  'personal-data',
  'contact-data',
  'md-settings',
  'encounters',
  'user-personal-data',
  'user-contact-data',
  'patient-personal-data',
  'patient-contact-data',
  'patient-otp',
  'roles',
  'studies',
  'study-results',
  'icd-10',
  'laboratories',
  'medications',
  'refes-establishments',
  'time-off-events',
  'prepagas',
  'referring-doctors',
  'user-roles',
  'passkey-credentials',
  'webauthn',
  'organizations',
  'organization-users',
  'organization-patients',
  'mailer',
  'invites',
  'signing-certificates',
  'document-signatures',
  'document-verification',
  'signed-exports',
  'stats',
  'practitioner-verification',
  'encounter-ai-chat',
  'encounter-ai-chat-messages',
  'llm-api-keys',
  'llm-models',
  'accounting',
  'accounting-settings',
  'payment-settings',
  'payment-connections',
  'appointment-payments',
  'practice-costs',
  'practices',
  'practice-codes',
  'prescriptions',
  'recetario',
  'whatsapp',
  'whatsapp-instances',
  'webhooks',
  'payments',
  'file-uploads',
  'url-fetch',
  'uploads',
  'shared-encounter-access',
  'access-logs',
  'identity-verifications',
  'sire-treatments',
  'sire-readings',
  'sire-dose-schedules',
  'sire-dose-logs',
  'sire-push-tokens',
  'patient-refresh-tokens',
  'form-templates',
  'form-template-versions',
  'healthz',
]);

function getFirstSegment(request: Request): string {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/?/, '/');
  return path.split('/')[1] ?? '';
}

function buildTargetUrl(request: Request): string {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/?/, '/');
  return `${API_URL()}${path}${url.search}`;
}

function forwardHeaders(request: Request): HeadersInit {
  const headers: Record<string, string> = {};
  for (const key of FORWARDED_HEADERS) {
    const value = request.headers.get(key);
    if (value) {
      headers[key] = value;
    }
  }
  if (PROXY_SECRET) {
    headers['x-proxy-token'] = PROXY_SECRET;

    const clientIp = getClientIp(request);
    if (clientIp) {
      headers['x-client-ip'] = clientIp;
    }
  }
  return headers;
}

async function proxyRequest(request: Request): Promise<Response> {
  if (!ALLOWED_PATHS.has(getFirstSegment(request))) {
    return new Response('Not Found', { status: 404 });
  }

  const targetUrl = buildTargetUrl(request);
  const hasBody = !['GET', 'HEAD'].includes(request.method);

  const response = await fetch(targetUrl, {
    method: request.method,
    headers: forwardHeaders(request),
    body: hasBody ? request.body : undefined,
    duplex: hasBody ? 'half' : undefined,
    // Pass 3xx through to the browser (the payment OAuth callback answers with
    // a redirect) instead of following it server-side.
    redirect: 'manual',
  });

  const responseHeaders = new Headers();
  response.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (lower !== 'transfer-encoding' && lower !== 'connection') {
      responseHeaders.set(key, value);
    }
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}

export const loader = ({ request }: LoaderFunctionArgs) => proxyRequest(request);
export const action = ({ request }: ActionFunctionArgs) => proxyRequest(request);
