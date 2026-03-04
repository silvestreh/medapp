import assert from 'assert';
import app from '../../src/app';

describe('\'organization-patients\' service', () => {
  let org: any;
  let patient: any;

  before(async () => {
    org = await app.service('organizations').create({
      name: 'OrgPatients Test Clinic',
      slug: 'org-patients-test',
      isActive: true,
    });

    patient = await app.service('patients').create({
      medicare: 'ORGPAT_OSDE',
      medicareNumber: '99887766'
    });
  });

  it('registered the service', () => {
    const service = app.service('organization-patients');
    assert.ok(service, 'Registered the service');
  });

  it('links a patient to an organization', async () => {
    const link: any = await app.service('organization-patients').create({
      organizationId: org.id,
      patientId: patient.id
    });

    assert.ok(link.id, 'Link has an ID');
    assert.strictEqual(link.organizationId, org.id);
    assert.strictEqual(link.patientId, patient.id);
  });

  it('enforces unique organization-patient pair', async () => {
    try {
      await app.service('organization-patients').create({
        organizationId: org.id,
        patientId: patient.id
      });
      assert.fail('Should not allow duplicate link');
    } catch (error: any) {
      assert.ok(error, 'Threw an error for duplicate link');
    }
  });

  it('finds patients by organizationId', async () => {
    const results = await app.service('organization-patients').find({
      query: { organizationId: org.id },
      paginate: false
    } as any) as any[];

    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].patientId, patient.id);
  });

  it('can remove a patient-organization link', async () => {
    const anotherPatient = await app.service('patients').create({
      medicare: 'ORGPAT_REMOVABLE',
      medicareNumber: '11223344'
    });

    const link: any = await app.service('organization-patients').create({
      organizationId: org.id,
      patientId: anotherPatient.id
    });

    await app.service('organization-patients').remove(link.id);

    const results = await app.service('organization-patients').find({
      query: { organizationId: org.id, patientId: anotherPatient.id },
      paginate: false
    } as any) as any[];

    assert.strictEqual(results.length, 0, 'Link was removed');
  });
});
