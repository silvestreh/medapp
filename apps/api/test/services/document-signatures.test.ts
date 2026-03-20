import assert from 'assert';
import app from '../../src/app';
import { createTestUser, createTestOrganization } from '../test-helpers';

describe('\'document-signatures\' service', () => {
  let org: any;
  let medic: any;
  let patient: any;

  before(async () => {
    org = await createTestOrganization();
    medic = await createTestUser({
      username: `docsig.medic.${Date.now()}`,
      password: 'SuperSecret1!',
      roleIds: ['medic'],
      organizationId: org.id,
    });

    patient = await app.service('patients').create({
      personalData: {
        firstName: 'DocSig',
        lastName: 'Patient',
        documentType: 'DNI',
        documentValue: `DS${Date.now()}`,
      },
    });
  });

  it('registered the service', () => {
    const service = app.service('document-signatures');
    assert.ok(service, 'Registered the service');
  });

  it('disallows external create (requires auth first)', async () => {
    try {
      await app.service('document-signatures').create({
        hash: 'a'.repeat(64),
        signedById: 'fake-user-id',
        patientId: 'fake-patient-id',
        signerName: 'Dr. Test',
        signedAt: new Date(),
        fileName: 'test.pdf',
        content: 'both',
      } as any, { provider: 'rest' } as any);
      assert.fail('Should throw an error');
    } catch (error: any) {
      // External calls are blocked (either NotAuthenticated or MethodNotAllowed)
      assert.ok(['NotAuthenticated', 'MethodNotAllowed'].includes(error.name));
    }
  });

  it('allows internal create', async () => {
    const result: any = await app.service('document-signatures').create({
      hash: 'b'.repeat(64),
      signedById: medic.id,
      patientId: patient.id,
      organizationId: org.id,
      signerName: 'Dr. Test',
      signedAt: new Date(),
      fileName: 'test.pdf',
      content: 'both',
      studyId: null,
    } as any, { provider: undefined } as any);

    assert.ok(result.id, 'Record created with an id');
    assert.strictEqual(result.hash, 'b'.repeat(64));
    assert.strictEqual(result.signerName, 'Dr. Test');
  });
});
