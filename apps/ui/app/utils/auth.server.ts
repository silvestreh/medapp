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
    throwLoginRedirect(request);
  }

  return token;
}

export function authenticatedLoader(loader?: LoaderFunction): LoaderFunction {
  return async (args: LoaderFunctionArgs) => {
    const token = await requireAuth(args.request);
    return loader ? loader({ ...args, token } as AuthenticatedLoaderArgs) : null;
  };
}

function getForwardHeaders(request: Request): Record<string, string> {
  const headers: Record<string, string> = {};
  const ua = request.headers.get('user-agent');
  if (ua) headers['user-agent'] = ua;

  // Forward client IP: prefer existing x-forwarded-for, fall back to connecting IP
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    headers['x-forwarded-for'] = forwarded;
  }
  return headers;
}

export async function getUser(request: Request) {
  const token = await getToken(request);

  if (!token) {
    return null;
  }

  try {
    const apiUrl = process.env.API_URL ?? 'http://localhost:3030';
    const client = createFeathersClient({
      baseURL: apiUrl,
      forwardHeaders: getForwardHeaders(request),
    });
    const auth = await client.authenticate({
      strategy: 'jwt',
      accessToken: token,
    });
    return auth.user;
  } catch (error: any) {
    return null;
  }
}

function throwLoginRedirect(request: Request): never {
  const url = new URL(request.url);
  throw redirect(`/login?redirect=${url.pathname}`);
}

export async function getAuthenticatedClient(request: Request): Promise<{ client: Application; user: Account }> {
  const token = await getToken(request);

  if (!token) {
    throwLoginRedirect(request);
  }

  let organizationId = await getCurrentOrganizationId(request);
  const client = createFeathersClient({
    baseURL: process.env.API_URL ?? 'http://localhost:3030',
    organizationId,
    forwardHeaders: getForwardHeaders(request),
  });

  try {
    const { user } = await client.authenticate({
      strategy: 'jwt',
      accessToken: token,
    });

    if (!organizationId && user?.organizations?.length) {
      organizationId = user.organizations[0].id;
      client.setOrganizationId(organizationId);
    }

    return { client, user };
  } catch (error) {
    // Token exists but is invalid/expired — redirect to login instead of
    // throwing a plain Error (which can break single-fetch turbo-stream encoding)
    throwLoginRedirect(request);
  }
}

export function isMedicVerified(user: any, orgRoleIds?: string[]): boolean {
  if (!orgRoleIds || !orgRoleIds.includes('medic')) {
    return true;
  }

  return user?.settings?.isVerified === true;
}

export function getCurrentOrgRoleIds(user: any, organizationId?: string): string[] {
  if (!user?.organizations?.length || !organizationId) return [];
  const org = user.organizations.find((o: any) => o.id === organizationId);
  return org?.roleIds || [];
}
