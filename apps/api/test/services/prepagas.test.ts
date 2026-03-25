import assert from 'assert';
import app from '../../src/app';
import { createTestUser, createTestOrganization } from '../test-helpers';

describe('\'prepagas\' service', () => {
  let org: any;
  let prescriber: any;
  let nonPrescriber: any;
  let testPrepaga: any;

  before(async () => {
    org = await createTestOrganization();

    prescriber = await createTestUser({
      username: `test.prescriber.prepagas.${Date.now()}`,
      password: 'SuperSecret1!',
      roleIds: ['prescriber'],
      organizationId: org.id,
    });

    nonPrescriber = await createTestUser({
      username: `test.receptionist.prepagas.${Date.now()}`,
      password: 'SuperSecret1!',
      roleIds: ['receptionist'],
      organizationId: org.id,
    });

    testPrepaga = await app.service('prepagas').create({
      denomination: 'Test Insurance Provider',
      shortName: 'TEST-INS',
      tiers: [],
    });
  });

  it('registered the service', () => {
    const service = app.service('prepagas');
    assert.ok(service, 'Registered the service');
  });

  it('allows a prescriber to patch recetarioHealthInsuranceName', async () => {
    const patched = await app.service('prepagas').patch(
      testPrepaga.id,
      { recetarioHealthInsuranceName: 'test insurance salud' },
      {
        provider: 'rest',
        user: prescriber,
        authenticated: true,
        organizationId: org.id,
      } as any
    );

    assert.strictEqual(
      patched.recetarioHealthInsuranceName,
      'test insurance salud',
      'recetarioHealthInsuranceName was updated'
    );
  });

  it('strips non-allowed fields when a prescriber patches', async () => {
    const patched = await app.service('prepagas').patch(
      testPrepaga.id,
      {
        recetarioHealthInsuranceName: 'updated insurance name',
        shortName: 'HACKED',
        denomination: 'Hacked Denomination',
      } as any,
      {
        provider: 'rest',
        user: prescriber,
        authenticated: true,
        organizationId: org.id,
      } as any
    );

    assert.strictEqual(
      patched.recetarioHealthInsuranceName,
      'updated insurance name',
      'recetarioHealthInsuranceName was updated'
    );
    assert.strictEqual(
      patched.shortName,
      'TEST-INS',
      'shortName was not changed'
    );
    assert.strictEqual(
      patched.denomination,
      'Test Insurance Provider',
      'denomination was not changed'
    );
  });

  it('rejects patch from a non-prescriber user', async () => {
    try {
      await app.service('prepagas').patch(
        testPrepaga.id,
        { recetarioHealthInsuranceName: 'should not work' },
        {
          provider: 'rest',
          user: nonPrescriber,
          authenticated: true,
          organizationId: org.id,
        } as any
      );
      assert.fail('Should have thrown Forbidden');
    } catch (error: any) {
      assert.strictEqual(error.code, 403, 'Returns 403 Forbidden');
    }
  });

  it('rejects patch from unauthenticated requests', async () => {
    try {
      await app.service('prepagas').patch(
        testPrepaga.id,
        { recetarioHealthInsuranceName: 'should not work' },
        {
          provider: 'rest',
        } as any
      );
      assert.fail('Should have thrown NotAuthenticated');
    } catch (error: any) {
      assert.strictEqual(error.code, 401, 'Returns 401 NotAuthenticated');
    }
  });

  after(async () => {
    if (testPrepaga) {
      await app.service('prepagas').remove(testPrepaga.id);
    }
  });
});
