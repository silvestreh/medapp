import assert from 'assert';
import app from '../../src/app';
import { Sequelize } from 'sequelize';
import { createTestUser, createTestOrganization } from '../test-helpers';

describe('\'encounter-chain-verification\' service', () => {
  let medic: any;

  before(async () => {
    const suffix = Date.now().toString(36);
    const org = await createTestOrganization();
    medic = await createTestUser({
      username: `test.medic.chain.verify.${suffix}`,
      password: 'SuperSecret1',
      roleIds: ['medic'],
      organizationId: org.id,
    });
  });

  it('registered the service', () => {
    const service = app.service('encounter-chain-verification');
    assert.ok(service, 'Registered the service');
  });

  it('returns valid for a patient with no encounters', async () => {
    const s = Date.now().toString(36);
    const patient = await app.service('patients').create({
      medicare: `VERIFY-EMPTY-${s}`,
      medicareNumber: `00001-${s}`
    });

    const result = await app.service('encounter-chain-verification').find({
      query: { patientId: patient.id },
      provider: undefined,
    }) as any;

    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.totalEncounters, 0);
  });

  it('returns valid for a patient with a valid chain', async () => {
    const s = Date.now().toString(36);
    const patient = await app.service('patients').create({
      medicare: `VERIFY-VALID-${s}`,
      medicareNumber: `00002-${s}`
    });

    await app.service('encounters').create({
      data: { notes: { values: { text: 'First' } } },
      date: new Date('2025-01-01'),
      medicId: medic.id,
      patientId: patient.id,
    });

    await app.service('encounters').create({
      data: { notes: { values: { text: 'Second' } } },
      date: new Date('2025-01-02'),
      medicId: medic.id,
      patientId: patient.id,
    });

    await app.service('encounters').create({
      data: { notes: { values: { text: 'Third' } } },
      date: new Date('2025-01-03'),
      medicId: medic.id,
      patientId: patient.id,
    });

    const result = await app.service('encounter-chain-verification').find({
      query: { patientId: patient.id },
      provider: undefined,
    }) as any;

    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.totalEncounters, 3);
    assert.strictEqual(result.verified, 3);
  });

  it('detects a tampered encounter in the chain', async () => {
    const sequelizeClient: Sequelize = app.get('sequelizeClient');
    const encryptionKey = process.env.ENCRYPTION_KEY;

    const s = Date.now().toString(36);
    const patient = await app.service('patients').create({
      medicare: `VERIFY-TAMPER-${s}`,
      medicareNumber: `00003-${s}`
    });

    await app.service('encounters').create({
      data: { notes: { values: { text: 'Chain 1' } } },
      date: new Date('2025-02-01'),
      medicId: medic.id,
      patientId: patient.id,
    });

    const enc2 = await app.service('encounters').create({
      data: { notes: { values: { text: 'Chain 2' } } },
      date: new Date('2025-02-02'),
      medicId: medic.id,
      patientId: patient.id,
    });

    await app.service('encounters').create({
      data: { notes: { values: { text: 'Chain 3' } } },
      date: new Date('2025-02-03'),
      medicId: medic.id,
      patientId: patient.id,
    });

    // Tamper with enc2's data
    const tamperedData = JSON.stringify({ notes: { values: { text: 'HACKED' } } });
    await sequelizeClient.query(
      'UPDATE encounters SET data = PGP_SYM_ENCRYPT(:data, :key) WHERE id = :id',
      {
        replacements: { data: tamperedData, key: encryptionKey, id: enc2.id }
      }
    );

    const result = await app.service('encounter-chain-verification').find({
      query: { patientId: patient.id },
      provider: undefined,
    }) as any;

    assert.strictEqual(result.valid, false);
    assert.ok(result.brokenAt, 'Should report where the chain broke');
    assert.strictEqual(result.brokenAt.encounterId, enc2.id);
    assert.strictEqual(result.brokenAt.position, 1);
  });
});
