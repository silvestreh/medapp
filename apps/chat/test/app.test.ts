import assert from 'assert';
import axios from 'axios';
import { startTestServer, stopTestServer } from './test-helpers';

describe('Chat API Application', () => {
  before(async () => {
    await startTestServer();
  });

  after(async () => {
    await stopTestServer();
  });

  it('starts and shows the health check endpoint', async () => {
    const res = await axios.get('http://localhost:8999/healthz');
    assert.equal(res.status, 200);
    assert.deepEqual(res.data, { ok: true });
  });

  it('shows a 404 page for unknown routes', async () => {
    try {
      await axios.get('http://localhost:8999/unknown-route');
      assert.fail('should not get here');
    } catch (err: any) {
      assert.equal(err.response.status, 404);
    }
  });
});
