import { type Application } from '@feathersjs/feathers';
import { redirect } from '@remix-run/node';
import type { LoaderFunction, LoaderFunctionArgs } from '@remix-run/node';

import { type Account } from '~/declarations';
import { getSession, getCurrentOrganizationId } from '~/session';
import createFeathersClient from '~/feathers';

interface AuthenticatedLoaderArgs extends LoaderFunctionArgs {
  token: string;
}

export async function getToken(request: Request) {
  const session = await getSession(request.headers.get('Cookie'));
  return session.get('feathers-jwt');
}

export async function requireAuth(request: Request) {
  const token = await getToken(request);

  if (!token) {
    const url = new URL(request.url);
    throw redirect(`/login?redirect=${url.pathname}`);
  }

  return token;
}

export function authenticatedLoader(loader?: LoaderFunction): LoaderFunction {
  return async (args: LoaderFunctionArgs) => {
    const token = await requireAuth(args.request);
    return loader ? loader({ ...args, token } as AuthenticatedLoaderArgs) : null;
  };
}

export async function getUser(request: Request) {
  const token = await getToken(request);

  if (!token) {
    return null;
  }

  try {
    const apiUrl = process.env.API_URL ?? 'http://localhost:3030';
    const client = createFeathersClient(apiUrl);
    const auth = await client.authenticate({
      strategy: 'jwt',
      accessToken: token,
    });
    return auth.user;
  } catch (error: any) {
    return null;
  }
}

export async function getAuthenticatedClient(request: Request): Promise<{ client: Application; user: Account }> {
  const token = await getToken(request);

  if (!token) {
    throw new Error('Token is required to authenticate the client');
  }

  const organizationId = await getCurrentOrganizationId(request);
  const client = createFeathersClient(process.env.API_URL ?? 'http://localhost:3030', undefined, organizationId);

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
