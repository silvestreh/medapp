import assert from 'assert';
import request from 'supertest';
import { setupTestApp, teardownTestApp, getApp, generateTestToken } from '../setup';

describe('Consent Routes (Integration)', () => {
  let token: string;

  before(async () => {
    await setupTestApp();
    token = generateTestToken();
  });

  after(async () => {
    await teardownTestApp();
  });

  it('should return empty search Bundle for consent', async () => {
    const res = await request(getApp())
      .get('/Consent?patient=any-patient-id')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    assert.strictEqual(res.body.resourceType, 'Bundle');
    assert.strictEqual(res.body.type, 'searchset');
    assert.strictEqual(res.body.total, 0);
  });
});
