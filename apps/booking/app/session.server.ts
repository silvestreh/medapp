import { createCookieSessionStorage } from '@remix-run/node';

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  throw new Error('SESSION_SECRET must be set');
}

export const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: 'patient-jwt',
    httpOnly: true,
    maxAge: 60 * 60 * 24, // 1 day
    path: '/',
    sameSite: 'lax',
    secrets: [sessionSecret],
    secure: process.env.NODE_ENV === 'production',
  },
});

export async function getPatientToken(request: Request): Promise<string | null> {
  const session = await sessionStorage.getSession(request.headers.get('Cookie'));
  return session.get('accessToken') || null;
}

export async function setPatientToken(request: Request, accessToken: string) {
  const session = await sessionStorage.getSession(request.headers.get('Cookie'));
  session.set('accessToken', accessToken);
  return sessionStorage.commitSession(session);
}

export async function clearPatientToken(request: Request) {
  const session = await sessionStorage.getSession(request.headers.get('Cookie'));
  return sessionStorage.destroySession(session);
}
