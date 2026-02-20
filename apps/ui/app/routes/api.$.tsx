import type { LoaderFunctionArgs, ActionFunctionArgs } from '@remix-run/node';

const API_URL = () => process.env.API_URL ?? 'http://localhost:3030';

const FORWARDED_HEADERS = ['content-type', 'authorization', 'accept'];

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
