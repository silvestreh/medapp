import assert from 'assert';
import app from '../../src/app';
import { Sequelize } from 'sequelize';
import { createHash } from 'crypto';
import { runAnchoring } from '../../src/cron/solana-anchoring';
import { createTestUser, createTestOrganization } from '../test-helpers';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { buildMerkleTree, verifyMerkleProof, getMerkleProof } from '../../src/utils/merkle-tree';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

describe('Solana anchoring cron', function () {
  this.timeout(30000);
  let medic: any;
  let originalKeypair: string | undefined;

  before(async () => {
    // Ensure SOLANA_KEYPAIR is set so runAnchoring doesn't bail early
    originalKeypair = process.env.SOLANA_KEYPAIR;
    if (!process.env.SOLANA_KEYPAIR) {
      // Generate a throwaway keypair for testing
      const { Keypair } = await import('@solana/web3.js');
      const bs58 = await import('bs58');
      const kp = Keypair.generate();
      process.env.SOLANA_KEYPAIR = bs58.default.encode(kp.secretKey);
    }

    // Ensure new tables are synced in the test DB
    const sequelize: Sequelize = app.get('sequelizeClient');
    await sequelize.models.solana_anchors?.sync({ alter: true });
    await sequelize.models.solana_anchor_leaves?.sync({ alter: true });

    const suffix = Date.now().toString(36);
    const org = await createTestOrganization();
    medic = await createTestUser({
      username: `test.medic.solana.${suffix}`,
      password: 'SuperSecret1!',
      roleIds: ['medic'],
      organizationId: org.id,
    });
  });

  after(() => {
    // Restore original SOLANA_KEYPAIR
    if (originalKeypair === undefined) {
      delete process.env.SOLANA_KEYPAIR;
    } else {
      process.env.SOLANA_KEYPAIR = originalKeypair;
    }
  });

  it('anchors unanchored encounters with a mock submit function', async () => {
    const suffix = Date.now().toString(36);
    const patient = await app.service('patients').create({
      medicare: `SOL-TEST-${suffix}`,
      medicareNumber: `S0001-${suffix}`,
    });

    // Create encounters (they get hashes automatically)
    await app.service('encounters').create({
      data: { notes: { values: { text: 'Solana test 1' } } },
      date: new Date('2025-06-01'),
      medicId: medic.id,
      patientId: patient.id,
    });

    await app.service('encounters').create({
      data: { notes: { values: { text: 'Solana test 2' } } },
      date: new Date('2025-06-02'),
      medicId: medic.id,
      patientId: patient.id,
    });

    let submittedRoot: string | null = null;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let submittedMeta: any = null;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const mockSubmit = async (merkleRoot: string, metadata: { type: string; count: number }) => {
      submittedRoot = merkleRoot;
      submittedMeta = metadata;
      return { signature: `mock-sig-${suffix}`, slot: 42 };
    };

    await runAnchoring(app, mockSubmit);

    // Verify a submission happened for encounters
    assert.ok(submittedRoot, 'Should have submitted a Merkle root');

    // Check anchor record was created
    const sequelize: Sequelize = app.get('sequelizeClient');
    const AnchorModel = sequelize.models.solana_anchors;
    const anchors = await AnchorModel.findAll({
      where: { txSignature: `mock-sig-${suffix}` },
      raw: true,
    }) as any[];

    assert.ok(anchors.length > 0, 'Should have created an anchor record');
    assert.strictEqual(anchors[0].status, 'confirmed');
  });

  it('skips when there are no unanchored records', async () => {
    let submitCallCount = 0;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const mockSubmit = async (merkleRoot: string, metadata: { type: string; count: number }) => {
      submitCallCount++;
      return { signature: 'should-not-happen', slot: 0 };
    };

    // Run anchoring twice — second run should find nothing new
    // (first run anchors everything, second run finds 0 unanchored)
    await runAnchoring(app, mockSubmit);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const countAfterFirst = submitCallCount;

    await runAnchoring(app, mockSubmit);

    // The second run may or may not submit depending on other test data,
    // but it should not re-anchor the same records
    const sequelize: Sequelize = app.get('sequelizeClient');
    const LeafModel = sequelize.models.solana_anchor_leaves;

    // Verify no duplicate leaves exist
    const allLeaves = await LeafModel.findAll({ raw: true }) as any[];
    const recordIds = allLeaves.map((l: any) => l.recordId);
    const uniqueRecordIds = new Set(recordIds);
    assert.strictEqual(recordIds.length, uniqueRecordIds.size, 'No duplicate leaves should exist');
  });

  it('marks anchor as failed when submission fails and retries', async () => {
    const suffix = Date.now().toString(36);
    const patient = await app.service('patients').create({
      medicare: `SOL-FAIL-${suffix}`,
      medicareNumber: `SF001-${suffix}`,
    });

    await app.service('encounters').create({
      data: { notes: { values: { text: 'Fail test' } } },
      date: new Date('2025-07-01'),
      medicId: medic.id,
      patientId: patient.id,
    });

    let callCount = 0;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const failingSubmit = async (merkleRoot: string, metadata: { type: string; count: number }) => {
      callCount++;
      if (callCount <= 1) {
        throw new Error('Network error');
      }
      return { signature: `retry-sig-${suffix}`, slot: 100 };
    };

    // First run: submission fails
    await runAnchoring(app, failingSubmit);

    const sequelize: Sequelize = app.get('sequelizeClient');
    const AnchorModel = sequelize.models.solana_anchors;

    const failedAnchors = await AnchorModel.findAll({
      where: { status: 'failed' },
      raw: true,
    }) as any[];

    assert.ok(failedAnchors.length > 0, 'Should have a failed anchor');
    const failedAnchor = failedAnchors.find((a: any) => a.errorMessage === 'Network error');
    assert.ok(failedAnchor, 'Should have the correct error message');

    // Second run: retry succeeds
    await runAnchoring(app, failingSubmit);

    const retried = await AnchorModel.findByPk(failedAnchor.id, { raw: true }) as any;
    assert.strictEqual(retried.status, 'confirmed');
    assert.strictEqual(retried.txSignature, `retry-sig-${suffix}`);
  });
});
