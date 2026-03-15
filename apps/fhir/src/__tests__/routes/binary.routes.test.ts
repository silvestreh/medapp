import assert from 'assert';
import request from 'supertest';
import { setupTestApp, teardownTestApp, getApp, generateTestToken } from '../setup';

describe('Binary Routes (Integration)', () => {
  let token: string;

  before(async () => {
    await setupTestApp();
    token = generateTestToken();
  });

  after(async () => {
    await teardownTestApp();
  });

  it('should return 404 for non-existent encounter', async () => {
    const res = await request(getApp())
      .get('/Binary/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);

    assert.strictEqual(res.body.resourceType, 'OperationOutcome');
    assert.strictEqual(res.body.issue[0].code, 'not-found');
  });

  it('should require authentication', async () => {
    await request(getApp())
      .get('/Binary/some-id')
      .expect(401);
  });
});
