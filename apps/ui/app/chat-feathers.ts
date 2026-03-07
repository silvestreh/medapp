import { feathers, type Application } from '@feathersjs/feathers';
import socketio from '@feathersjs/socketio-client';
import auth, { type AuthenticationClient } from '@feathersjs/authentication-client';
import io from 'socket.io-client';

type ChatApp = Application & {
  authenticate: AuthenticationClient['authenticate'];
  reAuthenticate: AuthenticationClient['reAuthenticate'];
  logout: AuthenticationClient['logout'];
};

const CHAT_API_URL =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_CHAT_API_URL) || 'http://localhost:3031';

export async function createChatClient(accessToken?: string): Promise<ChatApp> {
  console.log('[ChatFeathers] creating client, URL:', CHAT_API_URL);
  const socket = io(CHAT_API_URL, {
    transports: ['websocket'],
    forceNew: true,
  });

  socket.on('connect', () => console.log('[ChatFeathers] socket connected'));
  socket.on('connect_error', (err: Error) => console.error('[ChatFeathers] socket connect_error:', err.message));
  socket.on('disconnect', (reason: string) => console.warn('[ChatFeathers] socket disconnected:', reason));

  const client = feathers() as unknown as ChatApp;
  (client as any).configure(socketio(socket));
  (client as any).configure(auth({ storageKey: 'feathers-chat-jwt' }));

  if (accessToken) {
    console.log('[ChatFeathers] authenticating with JWT...');
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Chat auth timeout (10s)')), 10_000)
    );
    await Promise.race([client.authenticate({ strategy: 'jwt', accessToken }), timeout]);
    console.log('[ChatFeathers] authenticated OK');
  }

  return client;
}
