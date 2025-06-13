import { type Application } from '@feathersjs/feathers';
import { redirect } from '@remix-run/node';
import type { LoaderFunction, LoaderFunctionArgs } from '@remix-run/node';

import { type Account } from '~/declarations';
import { getSession } from '~/session';
import createFeathersClient from '~/feathers';

interface AuthenticatedLoaderArgs extends LoaderFunctionArgs {
  token: string;
}

export async function getToken(request: Request) {
  const session = await getSession(request.headers.get('Cookie'));
  return session.get('feathers-jwt');
}

/**
 * Example usage:
 * ```ts
 * export const loader = async ({ request }: LoaderFunctionArgs) => {
 *   await requireAuth(request);
 *   // your existing loader logic here
 *   return { someData: 'value' };
 * };
 * ```
 */
export async function requireAuth(request: Request) {
  const token = await getToken(request);

  if (!token) {
    const url = new URL(request.url);
    throw redirect(`/login?redirect=${url.pathname}`);
  }

  return token;
}

/**
 * Example usage:
 * ```ts
 * export const loader = authenticatedLoader(async ({ request }) => {
 *   // your existing loader logic here
 *   return { someData: 'value' };
 * });
 * ```
 * Or, if you want to use the default loader:
 * ```ts
 * export const loader = authenticatedLoader();
 * ```
 */
export function authenticatedLoader(loader?: LoaderFunction): LoaderFunction {
  return async (args: LoaderFunctionArgs) => {
    const token = await requireAuth(args.request);
    return loader ? loader({ ...args, token } as AuthenticatedLoaderArgs) : null;
  };
}

/**
 * Retrieves the authenticated user based on the JWT token.
 *
 * This function attempts to authenticate the user using the JWT token
 * obtained from the session. If the token is valid, it returns the user
 * object. If the token is invalid or an error occurs during authentication,
 * it returns null.
 *
 * @param {Request} request - The request object containing headers and other information.
 * @returns {Promise<Object|null>} - A promise that resolves to the user object if authentication is successful, or null otherwise.
 *
 * Example usage:
 *
 * ```ts
 * import { getUser } from '~/utils/auth.server';
 *
 * export const loader = async ({ request }: LoaderFunctionArgs) => {
 *   const user = await getUser(request);
 *   if (!user) {
 *     throw redirect('/login');
 *   }
 *   // your existing loader logic here
 *   return { user };
 * };
 * ```
 */
export async function getUser(request: Request) {
  const token = await getToken(request);

  if (!token) {
    return null;
  }

  try {
    const client = createFeathersClient(process.env.API_URL ?? 'http://localhost:3030');
    const auth = await client.authenticate({
      strategy: 'jwt',
      accessToken: token,
    });

    return auth.user;
  } catch (error) {
    return null;
  }
}

/**
 * Returns an authenticated Feathers client using the provided JWT token.
 *
 * This function creates a Feathers client and attempts to authenticate it
 * using the provided JWT token. If the authentication is successful, it
 * returns the authenticated client. If the authentication fails, it throws
 * an error.
 *
 * @param {Request} request - The request object containing headers and other information.
 * @returns {Promise<any>} - A promise that resolves to the authenticated Feathers client.
 *
 * Example usage:
 *
 * ```ts
 * import { getAuthenticatedClient } from '~/utils/auth.server';
 *
 * const client = await getAuthenticatedClient(request);
 * // use the authenticated client
 * ```
 */
export async function getAuthenticatedClient(request: Request): Promise<{ client: Application; user: Account }> {
  const token = await getToken(request);

  if (!token) {
    throw new Error('Token is required to authenticate the client');
  }

  const client = createFeathersClient(process.env.API_URL ?? 'http://localhost:3030');

  try {
    const { user } = await client.authenticate({
      strategy: 'jwt',
      accessToken: token,
    });

    return { client, user };
  } catch (error) {
    throw new Error('Failed to authenticate the client');
  }
}
