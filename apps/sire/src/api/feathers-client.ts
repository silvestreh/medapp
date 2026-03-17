import { feathers } from '@feathersjs/feathers';
import rest from '@feathersjs/rest-client';
import { API_URL } from '../constants';

export function createClient(token?: string) {
  const client = feathers();
  const restClient = rest(API_URL);

  const authenticatedFetch: typeof fetch = (input, init) =>
    fetch(input, {
      ...init,
      headers: {
        ...init?.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

  client.configure(restClient.fetch(authenticatedFetch));
  return client;
}
