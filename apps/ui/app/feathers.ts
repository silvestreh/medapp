import { feathers, type Application } from '@feathersjs/feathers';
import rest from '@feathersjs/rest-client';
import auth, { type AuthenticationClient } from '@feathersjs/authentication-client';
import axios from 'axios';

import type { SessionToken } from './session';

// pnpm module isolation prevents the auth-client's declare module augmentation
// from merging into Application, so we replicate it locally
export type AuthenticatedApp = Application & {
  authenticate: AuthenticationClient['authenticate'];
  reAuthenticate: AuthenticationClient['reAuthenticate'];
  logout: AuthenticationClient['logout'];
  organizationId?: string;
  setOrganizationId: (id: string | undefined) => void;
};

const BROWSER_PROXY_URL = '/api';

interface ClientOptions {
  baseURL?: string;
  accessToken?: SessionToken;
  organizationId?: string;
  /** Extra headers forwarded on every request (e.g. x-forwarded-for, user-agent from the original browser request). */
  forwardHeaders?: Record<string, string>;
}

const createFeathersClient = (
  baseURLOrOptions?: string | ClientOptions,
  accessToken?: SessionToken,
  organizationId?: string
) => {
  // Support both legacy positional args and options object
  const opts: ClientOptions =
    typeof baseURLOrOptions === 'object' && baseURLOrOptions !== null
      ? baseURLOrOptions
      : { baseURL: baseURLOrOptions, accessToken, organizationId };

  const resolvedURL = opts.baseURL ?? BROWSER_PROXY_URL;
  const client = feathers() as AuthenticatedApp;
  const restClient = rest(resolvedURL);
  const axiosInstance = axios.create();

  client.organizationId = opts.organizationId;

  client.setOrganizationId = (id: string | undefined) => {
    client.organizationId = id;
  };

  axiosInstance.interceptors.request.use(config => {
    if (client.organizationId) {
      config.headers['organization-id'] = client.organizationId;
    }
    if (opts.forwardHeaders) {
      for (const [key, value] of Object.entries(opts.forwardHeaders)) {
        config.headers[key] = value;
      }
    }
    return config;
  });

  (client as any).configure(restClient.axios(axiosInstance));
  (client as any).configure(auth({ storageKey: 'feathers-jwt' }));

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
