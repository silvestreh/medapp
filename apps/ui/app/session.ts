import { createCookieSessionStorage } from '@remix-run/node';

export type SessionToken = string | undefined;

if (!process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET must be set in your environment variables');
}

export const { getSession, commitSession, destroySession } = createCookieSessionStorage({
  cookie: {
    name: 'feathers-jwt',
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    secrets: [process.env.SESSION_SECRET],
    maxAge: 60 * 60 * 24 * 30, // 30 days
  },
});

export async function getCurrentOrganizationId(request: Request): Promise<string | undefined> {
  const session = await getSession(request.headers.get('Cookie'));
  return session.get('currentOrganizationId');
}

export async function setCurrentOrganizationId(request: Request, organizationId: string) {
  const session = await getSession(request.headers.get('Cookie'));
  session.set('currentOrganizationId', organizationId);
  return commitSession(session);
}
