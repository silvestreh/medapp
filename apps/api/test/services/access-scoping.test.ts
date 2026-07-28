import assert from 'assert';
import app from '../../src/app';
import { createTestUser, createTestOrganization } from '../test-helpers';

/**
 * Cross-cutting access-control tests: organization scoping, medic ownership
 * and shared-encounter-access grants on SIRE data and studies, patient-token
 * scoping, and read-path guards added to patients / study-results /
 * organization-patients / personal-data / organizations.
 */
describe('access scoping across services', () => {
  let orgA: any;
  let orgB: any;
  let medicA1: any;
  let medicA2: any;
  let medicB1: any;
  let patient1: any;
  let patient2: any;
  let treatmentA: any;
  let scheduleA: any;
  let readingA: any;
  let stamp: number;

  const asProvider = (user: any, organizationId?: string, extra: Record<string, any> = {}) => ({
    provider: 'rest',
    authenticated: true,
    user,
    ...(organizationId ? { organizationId } : {}),
    ...extra,
  } as any);

  before(async () => {
    stamp = Date.now();
    orgA = await createTestOrganization({ slug: `scoping-a-${stamp}` });
    orgB = await createTestOrganization({ slug: `scoping-b-${stamp}` });

    medicA1 = await createTestUser({
      username: `scoping.a1.${stamp}@test.com`,
      password: 'SuperSecret1!',
      roleIds: ['medic'],
      organizationId: orgA.id,
    });
    medicA2 = await createTestUser({
      username: `scoping.a2.${stamp}@test.com`,
      password: 'SuperSecret1!',
      roleIds: ['medic'],
      organizationId: orgA.id,
    });
    medicB1 = await createTestUser({
      username: `scoping.b1.${stamp}@test.com`,
      password: 'SuperSecret1!',
      roleIds: ['medic'],
      organizationId: orgB.id,
    });

    patient1 = await app.service('patients').create({
      personalData: {
        firstName: 'Scoping',
        lastName: 'PatientOne',
        documentValue: `scoping-p1-${stamp}`,
      },
      contactData: { phoneNumber: ['cel:1155551001'] },
    } as any);
    patient2 = await app.service('patients').create({
      personalData: {
        firstName: 'Scoping',
        lastName: 'PatientTwo',
        documentValue: `scoping-p2-${stamp}`,
      },
      contactData: { phoneNumber: ['cel:1155551002'] },
    } as any);

    await app.service('organization-patients').create({ organizationId: orgA.id, patientId: patient1.id } as any);
    await app.service('organization-patients').create({ organizationId: orgB.id, patientId: patient2.id } as any);

    treatmentA = await app.service('sire-treatments').create({
      patientId: patient1.id,
      organizationId: orgA.id,
      medicId: medicA1.id,
      medication: 'Acenocumarol',
      tabletDoseMg: 4,
      targetInrMin: 2.0,
      targetInrMax: 3.0,
      startDate: '2026-05-01',
      status: 'active',
    });

    scheduleA = await app.service('sire-dose-schedules').create({
      treatmentId: String(treatmentA.id),
      startDate: '2026-05-02',
      schedule: {
        monday: 0.5, tuesday: 0.5, wednesday: 0.5, thursday: 0.5,
        friday: 0.5, saturday: 0.5, sunday: null,
      },
      createdById: medicA1.id,
    });

    readingA = await app.service('sire-readings').create({
      treatmentId: String(treatmentA.id),
      patientId: patient1.id,
      organizationId: orgA.id,
      date: '2026-05-03',
      inr: 2.5,
      source: 'provider',
    });
  });

  describe('sire-treatments provider scoping', () => {
    it('does not return other orgs\' treatments', async () => {
      const result: any = await app.service('sire-treatments').find({
        query: {},
        paginate: false,
        ...asProvider(medicB1, orgB.id),
      });
      const rows = result.data || result;
      assert.ok(rows.every((t: any) => String(t.id) !== String(treatmentA.id)));
    });

    it('does not return another medic\'s treatments without a grant', async () => {
      const result: any = await app.service('sire-treatments').find({
        query: {},
        paginate: false,
        ...asProvider(medicA2, orgA.id),
      });
      const rows = result.data || result;
      assert.ok(rows.every((t: any) => String(t.id) !== String(treatmentA.id)));
    });

    it('rejects gets of another medic\'s treatment without a grant', async () => {
      await assert.rejects(
        app.service('sire-treatments').get(treatmentA.id, asProvider(medicA2, orgA.id)),
        (error: any) => error.code === 403
      );
    });

    it('rejects cross-org gets', async () => {
      await assert.rejects(
        app.service('sire-treatments').get(treatmentA.id, asProvider(medicB1, orgB.id)),
        (error: any) => error.code === 403
      );
    });

    it('requires an organization context', async () => {
      await assert.rejects(
        app.service('sire-treatments').find({ query: {}, ...asProvider(medicA1) }),
        (error: any) => error.code === 403
      );
    });

    it('returns own treatments', async () => {
      const result: any = await app.service('sire-treatments').find({
        query: {},
        paginate: false,
        ...asProvider(medicA1, orgA.id),
      });
      const rows = result.data || result;
      assert.ok(rows.some((t: any) => String(t.id) === String(treatmentA.id)));
    });

    it('blocks patient tokens from creating treatments', async () => {
      await assert.rejects(
        app.service('sire-treatments').create({
          patientId: patient1.id,
          organizationId: orgA.id,
          medicId: medicA1.id,
          medication: 'Warfarina',
          tabletDoseMg: 5,
          targetInrMin: 2,
          targetInrMax: 3,
          startDate: '2026-05-05',
          status: 'active',
        }, { patient: { id: String(patient1.id) } } as any),
        (error: any) => error.code === 403
      );
    });

    it('blocks patient tokens from getting foreign treatments', async () => {
      await assert.rejects(
        app.service('sire-treatments').get(treatmentA.id, {
          patient: { id: 'some-other-patient' },
        } as any),
        (error: any) => error.code === 404
      );
    });
  });

  describe('shared-encounter-access grants extend to SIRE data', () => {
    before(async () => {
      await app.service('shared-encounter-access').create({
        grantingMedicId: medicA1.id,
        grantedMedicId: medicA2.id,
        patientId: patient1.id,
        organizationId: orgA.id,
      } as any);
    });

    it('grants find access to the sharing medic\'s treatments', async () => {
      const result: any = await app.service('sire-treatments').find({
        query: {},
        paginate: false,
        ...asProvider(medicA2, orgA.id),
      });
      const rows = result.data || result;
      assert.ok(rows.some((t: any) => String(t.id) === String(treatmentA.id)));
    });

    it('grants get access to the shared treatment', async () => {
      const fetched: any = await app.service('sire-treatments').get(treatmentA.id, asProvider(medicA2, orgA.id));
      assert.strictEqual(String(fetched.id), String(treatmentA.id));
    });

    it('lets the shared medic patch the treatment', async () => {
      const patched: any = await app.service('sire-treatments').patch(treatmentA.id, {
        nextControlDate: '2026-06-01',
      }, asProvider(medicA2, orgA.id));
      assert.strictEqual(String(patched.id), String(treatmentA.id));
    });

    it('does not let the shared medic remove the treatment', async () => {
      await assert.rejects(
        app.service('sire-treatments').remove(treatmentA.id, asProvider(medicA2, orgA.id)),
        (error: any) => error.code === 403
      );
    });

    it('grants access to dose schedules of the shared treatment', async () => {
      const result: any = await app.service('sire-dose-schedules').find({
        query: {},
        paginate: false,
        ...asProvider(medicA2, orgA.id),
      });
      const rows = result.data || result;
      assert.ok(rows.some((s: any) => String(s.id) === String(scheduleA.id)));
    });

    it('grants access to readings of the shared treatment', async () => {
      const result: any = await app.service('sire-readings').find({
        query: {},
        paginate: false,
        ...asProvider(medicA2, orgA.id),
      });
      const rows = result.data || result;
      assert.ok(rows.some((r: any) => String(r.id) === String(readingA.id)));
    });
  });

  describe('sire child records provider scoping', () => {
    it('excludes other orgs\' schedules from find', async () => {
      const result: any = await app.service('sire-dose-schedules').find({
        query: {},
        paginate: false,
        ...asProvider(medicB1, orgB.id),
      });
      const rows = result.data || result;
      assert.ok(rows.every((s: any) => String(s.id) !== String(scheduleA.id)));
    });

    it('rejects finds filtered by a foreign treatmentId', async () => {
      await assert.rejects(
        app.service('sire-dose-schedules').find({
          query: { treatmentId: String(treatmentA.id) },
          ...asProvider(medicB1, orgB.id),
        }),
        (error: any) => error.code === 403
      );
    });

    it('rejects cross-org schedule gets', async () => {
      await assert.rejects(
        app.service('sire-dose-schedules').get(scheduleA.id, asProvider(medicB1, orgB.id)),
        (error: any) => error.code === 404
      );
    });

    it('rejects creating schedules on a foreign treatment', async () => {
      await assert.rejects(
        app.service('sire-dose-schedules').create({
          treatmentId: String(treatmentA.id),
          startDate: '2026-05-10',
          schedule: {
            monday: 1, tuesday: 1, wednesday: 1, thursday: 1,
            friday: 1, saturday: 1, sunday: null,
          },
          createdById: medicB1.id,
        }, asProvider(medicB1, orgB.id)),
        (error: any) => error.code === 403
      );
    });

    it('blocks patient tokens from creating schedules', async () => {
      await assert.rejects(
        app.service('sire-dose-schedules').create({
          treatmentId: String(treatmentA.id),
          startDate: '2026-05-11',
          schedule: {
            monday: 1, tuesday: 1, wednesday: 1, thursday: 1,
            friday: 1, saturday: 1, sunday: null,
          },
          createdById: medicA1.id,
        }, { patient: { id: String(patient1.id) } } as any),
        (error: any) => error.code === 403
      );
    });
  });

  describe('patient-token treatment ownership on creates', () => {
    it('lets a patient log a reading on their own treatment and forces patientId', async () => {
      const reading: any = await app.service('sire-readings').create({
        treatmentId: String(treatmentA.id),
        patientId: 'spoofed-patient-id',
        organizationId: 'spoofed-org',
        date: '2026-05-12',
        inr: 2.1,
        source: 'patient',
      }, { patient: { id: String(patient1.id) } } as any);

      assert.strictEqual(String(reading.patientId), String(patient1.id));
      assert.strictEqual(String(reading.organizationId), String(orgA.id));
    });

    it('rejects readings for another patient\'s treatment', async () => {
      await assert.rejects(
        app.service('sire-readings').create({
          treatmentId: String(treatmentA.id),
          patientId: patient2.id,
          organizationId: orgB.id,
          date: '2026-05-12',
          inr: 2.2,
          source: 'patient',
        }, { patient: { id: String(patient2.id) } } as any),
        (error: any) => error.code === 403
      );
    });
  });

  describe('patients read scoping', () => {
    it('rejects cross-org patient gets', async () => {
      await assert.rejects(
        app.service('patients').get(patient1.id, asProvider(medicB1, orgB.id, {
          orgPermissions: ['patients:get'],
        })),
        (error: any) => error.code === 404
      );
    });

    it('allows in-org patient gets', async () => {
      const fetched: any = await app.service('patients').get(patient1.id, asProvider(medicA1, orgA.id, {
        orgPermissions: ['patients:get'],
      }));
      assert.strictEqual(String(fetched.id), String(patient1.id));
    });
  });

  describe('junction and PII guards', () => {
    it('blocks external access to organization-patients', async () => {
      await assert.rejects(
        app.service('organization-patients').find({
          query: {},
          ...asProvider(medicA1, orgA.id),
        }),
        (error: any) => error.code === 405
      );
    });

    it('requires a documentValue to search personal-data externally', async () => {
      await assert.rejects(
        app.service('personal-data').find({
          query: { $limit: 50 },
          ...asProvider(medicA1, orgA.id),
        }),
        (error: any) => error.code === 400
      );
    });

    it('still finds personal-data by exact document externally', async () => {
      const result: any = await app.service('personal-data').find({
        query: { documentValue: `scoping-p1-${stamp}` },
        ...asProvider(medicA1, orgA.id),
      });
      const rows = result.data || result;
      assert.ok(rows.length > 0, 'Exact document lookup still works');
    });

    it('blocks external invite gets', async () => {
      await assert.rejects(
        app.service('invites').get('any-id', asProvider(medicB1, orgB.id)),
        (error: any) => error.code === 405
      );
    });
  });

  describe('organizations read scoping', () => {
    it('find only returns organizations the user belongs to', async () => {
      const result: any = await app.service('organizations').find({
        query: {},
        paginate: false,
        ...asProvider(medicA1, orgA.id),
      });
      const rows = result.data || result;
      assert.ok(rows.some((o: any) => String(o.id) === String(orgA.id)));
      assert.ok(rows.every((o: any) => String(o.id) !== String(orgB.id)));
    });

    it('get returns a minimal shape for non-members', async () => {
      const fetched: any = await app.service('organizations').get(orgB.id, asProvider(medicA1, orgA.id));
      assert.strictEqual(String(fetched.id), String(orgB.id));
      assert.strictEqual(fetched.settings, undefined);
    });
  });

  describe('study-results read scoping', () => {
    let study: any;
    let result: any;

    before(async () => {
      study = await app.service('studies').create({
        date: new Date(),
        protocol: 991,
        studies: ['anemia'],
        noOrder: false,
        medicId: medicA1.id,
        patientId: patient1.id,
        organizationId: orgA.id,
      } as any);

      result = await app.service('study-results').create({
        data: { result: 'Positive' },
        studyId: study.id,
        type: 'anemia',
      } as any);
    });

    it('excludes other orgs\' results from find', async () => {
      const found: any = await app.service('study-results').find({
        query: {},
        paginate: false,
        ...asProvider(medicB1, orgB.id),
      });
      const rows = found.data || found;
      assert.ok(rows.every((r: any) => String(r.id) !== String(result.id)));
    });

    it('returns own results', async () => {
      const found: any = await app.service('study-results').find({
        query: {},
        paginate: false,
        ...asProvider(medicA1, orgA.id),
      });
      const rows = found.data || found;
      assert.ok(rows.some((r: any) => String(r.id) === String(result.id)));
    });

    it('rejects cross-org result gets', async () => {
      await assert.rejects(
        app.service('study-results').get(result.id, asProvider(medicB1, orgB.id)),
        (error: any) => error.code === 404
      );
    });

    it('grants access through share grants', async () => {
      const found: any = await app.service('study-results').find({
        query: {},
        paginate: false,
        ...asProvider(medicA2, orgA.id),
      });
      const rows = found.data || found;
      assert.ok(rows.some((r: any) => String(r.id) === String(result.id)));
    });
  });

  describe('encounter-chain-verification scoping', () => {
    it('rejects verification for patients outside the organization', async () => {
      await assert.rejects(
        app.service('encounter-chain-verification').find({
          query: { patientId: String(patient1.id) },
          ...asProvider(medicB1, orgB.id),
        }),
        (error: any) => error.code === 404
      );
    });
  });
});
