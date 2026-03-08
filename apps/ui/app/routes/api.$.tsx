import type { LoaderFunctionArgs, ActionFunctionArgs } from '@remix-run/node';

const API_URL = () => process.env.API_URL ?? 'http://localhost:3030';

const FORWARDED_HEADERS = ['content-type', 'authorization', 'accept', 'organization-id'];

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
  'roles',
  'studies',
  'study-results',
  'icd-10',
  'laboratories',
  'medications',
  'time-off-events',
  'prepagas',
  'referring-doctors',
  'user-roles',
  'profile',
  'passkey-credentials',
  'webauthn',
  'organizations',
  'organization-users',
  'organization-patients',
  'mailer',
  'invites',
  'signing-certificates',
  'signed-exports',
  'stats',
  'practitioner-verification',
  'encounter-ai-chat',
  'encounter-ai-chat-messages',
  'llm-api-keys',
  'llm-models',
  'accounting',
  'accounting-settings',
  'practice-costs',
  'prescriptions',
  'recetario',
  'whatsapp',
  'webhooks',
  'file-uploads',
  'uploads',
  'shared-encounter-access',
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
