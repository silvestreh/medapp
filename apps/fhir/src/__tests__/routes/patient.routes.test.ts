import assert from 'assert';
import request from 'supertest';
import { setupTestApp, teardownTestApp, getApp, generateTestToken } from '../setup';

describe('Patient Routes (Integration)', () => {
  let token: string;

  before(async () => {
    await setupTestApp();
    token = generateTestToken();
  });

  after(async () => {
    await teardownTestApp();
  });

  describe('GET /Patient', () => {
    it('should return a search Bundle for _id search', async () => {
      const res = await request(getApp())
        .get('/Patient?_id=nonexistent-id')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      assert.strictEqual(res.body.resourceType, 'Bundle');
      assert.strictEqual(res.body.type, 'searchset');
      assert.strictEqual(res.body.total, 0);
    });

    it('should return a search Bundle when no filter params provided', async () => {
      const res = await request(getApp())
        .get('/Patient')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      assert.strictEqual(res.body.resourceType, 'Bundle');
      assert.strictEqual(res.body.type, 'searchset');
      assert.ok(typeof res.body.total === 'number');
    });

    it('should support name search returning a Bundle', async () => {
      const res = await request(getApp())
        .get('/Patient?name=TestName')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      assert.strictEqual(res.body.resourceType, 'Bundle');
      assert.strictEqual(res.body.type, 'searchset');
      assert.ok(typeof res.body.total === 'number');
    });
  });

  describe('GET /Patient/:id', () => {
    it('should return 404 for non-existent patient', async () => {
      const res = await request(getApp())
        .get('/Patient/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);

      assert.strictEqual(res.body.resourceType, 'OperationOutcome');
      assert.strictEqual(res.body.issue[0].code, 'not-found');
    });
  });
});
