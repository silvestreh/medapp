import { feathers } from '@feathersjs/feathers';
import rest from '@feathersjs/rest-client';

const API_URL = process.env.API_URL || 'http://localhost:3030';
const PROXY_SECRET = process.env.PROXY_SECRET || '';

export function createClient(token?: string, clientIp?: string | null) {
  const client = feathers();
  const restClient = rest(API_URL);

  const wrappedFetch: typeof fetch = (input, init) => fetch(input, {
    ...init,
    headers: {
      ...init?.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(PROXY_SECRET ? { 'x-proxy-token': PROXY_SECRET } : {}),
      // Only meaningful alongside the proxy token — the API ignores it otherwise.
      ...(PROXY_SECRET && clientIp ? { 'x-client-ip': clientIp } : {}),
    },
  });

  client.configure(restClient.fetch(wrappedFetch));

  return client;
}
