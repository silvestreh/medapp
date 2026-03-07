import app from '../src/app';
import { Server } from 'http';

const port = 8999;
let server: Server;
let started = false;
let startPromise: Promise<void> | null = null;

export async function startTestServer(): Promise<void> {
  if (started) return;

  if (startPromise) return startPromise;

  startPromise = new Promise<void>(async (resolve, reject) => {
    try {
      server = app.listen(port, () => {
        started = true;
        // Wait for sequelize sync after listen
        const syncPromise = app.get('sequelizeSync');
        if (syncPromise) {
          syncPromise.then(() => resolve()).catch(reject);
        } else {
          resolve();
        }
      });
    } catch (err) {
      reject(err);
    }
  });

  return startPromise;
}

export async function stopTestServer(): Promise<void> {
  // Don't stop between test suites — mocha --exit handles cleanup
}

export function getApp() {
  return app;
}

/**
 * Create a mock user param object for internal service calls
 * (bypasses JWT auth by using provider: undefined)
 */
export function internalParams(userId: string) {
  return {
    provider: undefined,
    user: { id: userId, username: `user-${userId}` },
  };
}
