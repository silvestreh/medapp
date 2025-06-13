import { feathers } from '@feathersjs/feathers';
import rest from '@feathersjs/rest-client';
import auth from '@feathersjs/authentication-client';
import axios from 'axios';

import type { SessionToken } from './session';

const createFeathersClient = (baseURL: string, accessToken?: SessionToken) => {
  const client = feathers();
  const restClient = rest(baseURL);

  client.configure(restClient.axios(axios));
  client.configure(auth({ storageKey: 'feathers-jwt' }));

  if (accessToken) {
    client.authenticate({ strategy: 'jwt', accessToken }).catch(() => {
      axios
        .post('/logout')
        .then(() => {
          window.location.href = '/login';
        })
        .catch(error => {
          console.error('Error logging out:', error);
        });
    });
  }

  return client;
};

export default createFeathersClient;
