import assert from 'assert';
import app from '../../src/app';
import { Sequelize } from 'sequelize';
import { createHash } from 'crypto';
import { buildMerkleTree, verifyMerkleProof } from '../../src/utils/merkle-tree';

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

describe('\'solana-anchor-verification\' service', function () {
  this.timeout(30000);

  before(async () => {
    const sequelize: Sequelize = app.get('sequelizeClient');
    await sequelize.models.solana_anchors?.sync({ alter: true });
    await sequelize.models.solana_anchor_leaves?.sync({ alter: true });
  });

  it('registered the service', () => {
    const service = app.service('solana-anchor-verification');
    assert.ok(service, 'Registered the service');
  });

  it('returns anchored: false for an unanchored record', async () => {
    const result = await app.service('solana-anchor-verification').find({
      query: { recordId: 'nonexistent-id', chainType: 'encounters' },
      provider: undefined,
    }) as any;

    assert.strictEqual(result.anchored, false);
    assert.strictEqual(result.recordId, 'nonexistent-id');
  });

  it('returns a valid Merkle proof for an anchored record', async () => {
    const sequelize: Sequelize = app.get('sequelizeClient');
    const AnchorModel = sequelize.models.solana_anchors;
    const LeafModel = sequelize.models.solana_anchor_leaves;

    // Create test hashes and build a tree
    const hashes = [sha256('record-1'), sha256('record-2'), sha256('record-3')];
    const tree = buildMerkleTree(hashes);

    // Create an anchor record
    const anchor = await AnchorModel.create({
      merkleRoot: tree.root,
      leafCount: hashes.length,
      chainType: 'encounters',
      status: 'confirmed',
      txSignature: 'fake-sig-' + Date.now(),
      slot: 12345,
      network: 'devnet',
      batchStartDate: new Date('2025-01-01'),
      batchEndDate: new Date('2025-01-03'),
    }) as any;

    // Create leaf records
    for (let i = 0; i < hashes.length; i++) {
      await LeafModel.create({
        anchorId: anchor.id,
        recordId: `test-record-${i}-${Date.now()}`,
        recordHash: hashes[i],
        leafIndex: i,
      });
    }

    // Verify the first record
    const leaves = await LeafModel.findAll({
      where: { anchorId: anchor.id },
      order: [['leafIndex', 'ASC']],
      raw: true,
    }) as any[];

    const result = await app.service('solana-anchor-verification').find({
      query: { recordId: leaves[0].recordId, chainType: 'encounters' },
      provider: undefined,
    }) as any;

    assert.strictEqual(result.anchored, true);
    assert.strictEqual(result.anchor.merkleRoot, tree.root);
    assert.strictEqual(result.anchor.leafCount, 3);
    assert.ok(result.proof, 'Should include a Merkle proof');
    assert.strictEqual(result.proof.leaf, hashes[0]);

    // Verify the proof is valid
    assert.strictEqual(verifyMerkleProof(result.proof), true);
  });

  it('returns valid proofs for all leaves in a batch', async () => {
    const sequelize: Sequelize = app.get('sequelizeClient');
    const AnchorModel = sequelize.models.solana_anchors;
    const LeafModel = sequelize.models.solana_anchor_leaves;

    const hashes = [sha256('a-1'), sha256('b-2'), sha256('c-3'), sha256('d-4')];
    const tree = buildMerkleTree(hashes);
    const suffix = Date.now().toString(36);

    const anchor = await AnchorModel.create({
      merkleRoot: tree.root,
      leafCount: hashes.length,
      chainType: 'access_logs',
      status: 'confirmed',
      txSignature: 'fake-sig-all-' + suffix,
      slot: 99999,
      network: 'devnet',
      batchStartDate: new Date('2025-03-01'),
      batchEndDate: new Date('2025-03-04'),
    }) as any;

    const recordIds: string[] = [];
    for (let i = 0; i < hashes.length; i++) {
      const recordId = `all-leaf-${i}-${suffix}`;
      recordIds.push(recordId);
      await LeafModel.create({
        anchorId: anchor.id,
        recordId,
        recordHash: hashes[i],
        leafIndex: i,
      });
    }

    for (let i = 0; i < recordIds.length; i++) {
      const result = await app.service('solana-anchor-verification').find({
        query: { recordId: recordIds[i], chainType: 'access_logs' },
        provider: undefined,
      }) as any;

      assert.strictEqual(result.anchored, true);
      assert.strictEqual(result.proof.leaf, hashes[i]);
      assert.strictEqual(verifyMerkleProof(result.proof), true, `Proof for leaf ${i} should be valid`);
    }
  });
});
