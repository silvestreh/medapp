import { feathers, type Application } from '@feathersjs/feathers';
import rest from '@feathersjs/rest-client';
import auth, { type AuthenticationClient } from '@feathersjs/authentication-client';
import axios from 'axios';

import type { SessionToken } from './session';

// pnpm module isolation prevents the auth-client's declare module augmentation
// from merging into Application, so we replicate it locally
type AuthenticatedApp = Application & {
  authenticate: AuthenticationClient['authenticate'];
  reAuthenticate: AuthenticationClient['reAuthenticate'];
  logout: AuthenticationClient['logout'];
};

const createFeathersClient = (baseURL: string, accessToken?: SessionToken) => {
  const client = feathers() as AuthenticatedApp;
  const restClient = rest(baseURL);

  client.configure(restClient.axios(axios));
  client.configure(auth({ storageKey: 'feathers-jwt' }));

  if (accessToken) {
    console.log('[feathers] authenticating with JWT, baseURL:', baseURL);
    client.authenticate({ strategy: 'jwt', accessToken }).catch((err) => {
      console.error('[feathers] JWT auth failed:', err?.message || err);
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
