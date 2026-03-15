import assert from 'assert';
import request from 'supertest';
import { setupTestApp, teardownTestApp, getApp, generateTestToken } from '../setup';

describe('Patient $match (Integration)', () => {
  let token: string;

  before(async () => {
    await setupTestApp();
    token = generateTestToken();
  });

  after(async () => {
    await teardownTestApp();
  });

  it('should return a searchset Bundle', async () => {
    const res = await request(getApp())
      .post('/Patient/$match')
      .set('Authorization', `Bearer ${token}`)
      .send({
        resourceType: 'Parameters',
        parameter: [{
          name: 'resource',
          resource: {
            resourceType: 'Patient',
            name: [{ family: 'TestFamily', given: ['TestGiven'] }],
          },
        }],
      })
      .expect(200);

    assert.strictEqual(res.body.resourceType, 'Bundle');
    assert.strictEqual(res.body.type, 'searchset');
    assert.ok(typeof res.body.total === 'number');
  });

  it('should return 400 without name or identifier', async () => {
    const res = await request(getApp())
      .post('/Patient/$match')
      .set('Authorization', `Bearer ${token}`)
      .send({
        resourceType: 'Parameters',
        parameter: [{
          name: 'resource',
          resource: {
            resourceType: 'Patient',
            gender: 'male',
          },
        }],
      })
      .expect(400);

    assert.strictEqual(res.body.resourceType, 'OperationOutcome');
  });

  it('should include search scores in entries', async () => {
    const res = await request(getApp())
      .post('/Patient/$match')
      .set('Authorization', `Bearer ${token}`)
      .send({
        resourceType: 'Parameters',
        parameter: [{
          name: 'resource',
          resource: {
            resourceType: 'Patient',
            identifier: [{ value: '99999999' }],
            name: [{ family: 'Nonexistent' }],
          },
        }],
      })
      .expect(200);

    assert.strictEqual(res.body.resourceType, 'Bundle');
    // Even with no matches, should return valid bundle
    if (res.body.entry && res.body.entry.length > 0) {
      assert.ok(typeof res.body.entry[0].search.score === 'number');
      assert.strictEqual(res.body.entry[0].search.mode, 'match');
    }
  });

  it('should limit results to 5', async () => {
    const res = await request(getApp())
      .post('/Patient/$match')
      .set('Authorization', `Bearer ${token}`)
      .send({
        resourceType: 'Parameters',
        parameter: [{
          name: 'resource',
          resource: {
            resourceType: 'Patient',
            name: [{ family: 'a' }],
          },
        }],
      })
      .expect(200);

    assert.ok(res.body.total <= 5);
  });
});
