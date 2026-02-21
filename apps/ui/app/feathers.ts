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
  organizationId?: string;
  setOrganizationId: (id: string | undefined) => void;
};

const BROWSER_PROXY_URL = '/api';

const createFeathersClient = (baseURL?: string, accessToken?: SessionToken, organizationId?: string) => {
  const resolvedURL = baseURL ?? BROWSER_PROXY_URL;
  const client = feathers() as AuthenticatedApp;
  const restClient = rest(resolvedURL);
  const axiosInstance = axios.create();

  client.organizationId = organizationId;

  client.setOrganizationId = (id: string | undefined) => {
    client.organizationId = id;
  };

  axiosInstance.interceptors.request.use((config) => {
    if (client.organizationId) {
      config.headers['organization-id'] = client.organizationId;
    }
    return config;
  });

  client.configure(restClient.axios(axiosInstance));
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
