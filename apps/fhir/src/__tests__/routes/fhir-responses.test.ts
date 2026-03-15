import assert from 'assert';
import request from 'supertest';
import { setupTestApp, teardownTestApp, getApp, generateTestToken } from '../setup';

describe('FHIR Response Format (Integration)', () => {
  let token: string;

  before(async () => {
    await setupTestApp();
    token = generateTestToken();
  });

  after(async () => {
    await teardownTestApp();
  });

  it('should return OperationOutcome for 404', async () => {
    const res = await request(getApp())
      .get('/NonExistentResource')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);

    assert.strictEqual(res.body.resourceType, 'OperationOutcome');
    assert.strictEqual(res.body.issue[0].severity, 'error');
  });

  it('should return FHIR content type on all responses', async () => {
    const res = await request(getApp())
      .get('/metadata')
      .expect(200);

    assert.ok(res.headers['content-type'].includes('application/fhir+json'));
  });

  it('should include rate limit headers', async () => {
    const res = await request(getApp())
      .get('/metadata')
      .expect(200);

    // express-rate-limit v7 uses standardHeaders: 'draft-7' which sets ratelimit-* headers
    const hasRateLimitHeader = Object.keys(res.headers).some(
      (h) => h.toLowerCase().includes('ratelimit')
    );
    assert.ok(hasRateLimitHeader, 'Expected rate limit headers in response');
  });
});
