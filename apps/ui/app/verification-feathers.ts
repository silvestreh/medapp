import { feathers, type Application } from '@feathersjs/feathers';
import socketio from '@feathersjs/socketio-client';
import auth, { type AuthenticationClient } from '@feathersjs/authentication-client';
import io from 'socket.io-client';

type VerificationApp = Application & {
  authenticate: AuthenticationClient['authenticate'];
  reAuthenticate: AuthenticationClient['reAuthenticate'];
  logout: AuthenticationClient['logout'];
};

const VERIFICATION_API_URL =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_VERIFICATION_API_URL) || 'http://localhost:3032';

export function getVerificationApiUrl(): string {
  return VERIFICATION_API_URL;
}

export async function createVerificationClient(accessToken?: string): Promise<VerificationApp> {
  const socket = io(VERIFICATION_API_URL, {
    transports: ['websocket'],
    forceNew: true,
  });

  const client = feathers() as unknown as VerificationApp;
  (client as any).configure(socketio(socket));
  (client as any).configure(auth({ storageKey: 'feathers-verification-jwt' }));

  if (accessToken) {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Verification auth timeout (10s)')), 10_000)
    );
    await Promise.race([client.authenticate({ strategy: 'jwt', accessToken }), timeout]);
  }

  return client;
}
