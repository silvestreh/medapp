import { feathers } from '@feathersjs/feathers';
import rest from '@feathersjs/rest-client';

const API_URL = process.env.API_URL || 'http://localhost:3030';

export function createClient(token?: string) {
  const client = feathers();
  const restClient = rest(API_URL);

  // Wrap fetch to inject Authorization header when a token is provided
  const authenticatedFetch: typeof fetch = token
    ? (input, init) => fetch(input, {
      ...init,
      headers: { ...init?.headers, Authorization: `Bearer ${token}` },
    })
    : fetch;

  client.configure(restClient.fetch(authenticatedFetch));

  return client;
}
