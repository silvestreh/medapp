import assert from 'assert';
import axios from 'axios';
import { startTestServer, stopTestServer, getApp } from './test-helpers';

/**
 * These tests require the main API to be running on port 3030.
 * They authenticate via the main API to get a JWT,
 * then use that JWT to authenticate with the chat API.
 *
 * Start the main API first: pnpm --filter athelas-api dev
 * Then run: pnpm --filter athelas-chat test
 */

const MAIN_API_URL = 'http://localhost:3030';
const CHAT_API_URL = 'http://localhost:8999';

async function isMainApiRunning(): Promise<boolean> {
  try {
    await axios.get(`${MAIN_API_URL}/healthz`, { timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}

describe('Authentication (requires main API on :3030)', () => {
  let mainApiAvailable = false;
  let accessToken: string;
  let userId: string;

  before(async function () {
    this.timeout(15000);
    await startTestServer();
    mainApiAvailable = await isMainApiRunning();

    if (!mainApiAvailable) {
      console.log('    Main API not running on :3030 — skipping auth tests');
      return;
    }

    // Authenticate with username/password against the main API to get a JWT
    const authRes = await axios.post(`${MAIN_API_URL}/authentication`, {
      strategy: 'local',
      username: 'admin',
      password: 'Retrete4u!',
    });
    accessToken = authRes.data.accessToken;
    userId = authRes.data.user.id;
  });

  after(async () => {
    if (mainApiAvailable) {
      try {
        const chatSequelize = getApp().get('sequelizeClient');
        await chatSequelize.models.conversation_participants.destroy({ where: {} });
        await chatSequelize.models.conversations.destroy({ where: {} });
      } catch { /* ignore */ }
    }

    await stopTestServer();
  });

  it('authenticates on the chat API using a JWT from the main API', async function () {
    if (!mainApiAvailable) return this.skip();

    const res = await axios.post(`${CHAT_API_URL}/authentication`, {
      strategy: 'jwt',
      accessToken,
    });

    assert.ok(res.data.accessToken, 'Chat API should return an access token');
    assert.ok(res.data.user, 'Chat API should return user data');
    assert.equal(res.data.user.id, userId, 'User ID should match');
  });

  it('rejects an invalid JWT on the chat API', async function () {
    if (!mainApiAvailable) return this.skip();

    try {
      await axios.post(`${CHAT_API_URL}/authentication`, {
        strategy: 'jwt',
        accessToken: 'invalid.jwt.token',
      });
      assert.fail('should have thrown');
    } catch (err: any) {
      assert.equal(err.response.status, 401);
    }
  });

  it('accesses a protected service with the JWT', async function () {
    if (!mainApiAvailable) return this.skip();

    const res = await axios.post(
      `${CHAT_API_URL}/conversations`,
      { name: 'Auth Test Conv', participantIds: [userId] },
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    assert.ok(res.data.id);
    assert.equal(res.data.name, 'Auth Test Conv');
    assert.equal(res.data.participants.length, 1);
    assert.equal(res.data.participants[0].userId, userId);
  });

  it('rejects access without a JWT', async function () {
    if (!mainApiAvailable) return this.skip();

    try {
      await axios.get(`${CHAT_API_URL}/conversations`);
      assert.fail('should have thrown');
    } catch (err: any) {
      assert.equal(err.response.status, 401);
    }
  });
});
