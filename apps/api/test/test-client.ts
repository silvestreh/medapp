import feathers from '@feathersjs/feathers';
import rest from '@feathersjs/rest-client';
import auth from '@feathersjs/authentication-client';
import axios from 'axios';
import app from '../src/app';

const port = app.get('port') || 3030;

export function createTestClient(organizationId?: string) {
  const instance = axios.create({
    ...(organizationId ? { headers: { 'organization-id': organizationId } } : {}),
  });
  const client = feathers();
  const restClient = rest(`http://localhost:${port}`);
  client.configure(restClient.axios(instance));
  client.configure(auth());
  return client;
}

const client = createTestClient();

export default client;
