import assert from 'assert';
import request from 'supertest';
import { setupTestApp, teardownTestApp, getApp } from '../setup';

describe('GET /metadata', () => {
  before(async () => {
    await setupTestApp();
  });

  after(async () => {
    await teardownTestApp();
  });

  it('should return CapabilityStatement without auth', async () => {
    const res = await request(getApp())
      .get('/metadata')
      .expect(200);

    assert.strictEqual(res.body.resourceType, 'CapabilityStatement');
    assert.strictEqual(res.body.status, 'active');
    assert.strictEqual(res.body.fhirVersion, '4.0.1');
  });

  it('should include FHIR content-type header', async () => {
    const res = await request(getApp())
      .get('/metadata')
      .expect(200);

    assert.ok(res.headers['content-type'].includes('application/fhir+json'));
  });

  it('should list supported resource types', async () => {
    const res = await request(getApp())
      .get('/metadata')
      .expect(200);

    const types = res.body.rest?.[0]?.resource?.map((r: { type: string }) => r.type) || [];
    assert.ok(types.includes('Patient'), 'Missing Patient');
    assert.ok(types.includes('Practitioner'), 'Missing Practitioner');
    assert.ok(types.includes('Organization'), 'Missing Organization');
    assert.ok(types.includes('DocumentReference'), 'Missing DocumentReference');
    assert.ok(types.includes('Consent'), 'Missing Consent');
  });
});
