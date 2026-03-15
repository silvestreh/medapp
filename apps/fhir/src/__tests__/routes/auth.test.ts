import assert from 'assert';
import request from 'supertest';
import { setupTestApp, teardownTestApp, getApp, generateTestToken } from '../setup';

describe('JWT Authentication', () => {
  before(async () => {
    await setupTestApp();
  });

  after(async () => {
    await teardownTestApp();
  });

  it('should reject requests without Authorization header', async () => {
    const res = await request(getApp())
      .get('/Patient')
      .expect(401);

    assert.strictEqual(res.body.resourceType, 'OperationOutcome');
    assert.strictEqual(res.body.issue[0].code, 'login');
  });

  it('should reject requests with invalid token', async () => {
    const res = await request(getApp())
      .get('/Patient')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);

    assert.strictEqual(res.body.resourceType, 'OperationOutcome');
  });

  it('should accept requests with valid token', async () => {
    const token = generateTestToken();
    const res = await request(getApp())
      .get('/Patient?_id=nonexistent')
      .set('Authorization', `Bearer ${token}`);

    // Should get through auth (200 with empty bundle, or 400 for missing params — NOT 401)
    assert.notStrictEqual(res.status, 401);
  });

  it('should allow /metadata without auth', async () => {
    await request(getApp())
      .get('/metadata')
      .expect(200);
  });
});
