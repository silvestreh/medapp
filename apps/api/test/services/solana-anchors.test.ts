import assert from 'assert';
import { Sequelize } from 'sequelize';
import app from '../../src/app';

describe('\'solana-anchors\' service', function () {
  this.timeout(30000);

  before(async () => {
    const sequelize: Sequelize = app.get('sequelizeClient');
    await sequelize.models.solana_anchors?.sync({ alter: true });
    await sequelize.models.solana_anchor_leaves?.sync({ alter: true });
  });

  it('registered the service', () => {
    const service = app.service('solana-anchors');
    assert.ok(service, 'Registered the service');
  });

  it('allows internal create', async () => {
    const anchor = await app.service('solana-anchors').create({
      merkleRoot: 'a'.repeat(64),
      leafCount: 5,
      chainType: 'encounters',
      status: 'pending',
      network: 'devnet',
      batchStartDate: new Date('2025-01-01'),
      batchEndDate: new Date('2025-01-02'),
    });

    assert.ok(anchor.id);
    assert.strictEqual(anchor.merkleRoot, 'a'.repeat(64));
    assert.strictEqual(anchor.leafCount, 5);
    assert.strictEqual(anchor.status, 'pending');
  });

  it('disallows external create', async () => {
    try {
      await app.service('solana-anchors').create(
        {
          merkleRoot: 'b'.repeat(64),
          leafCount: 1,
          chainType: 'encounters',
          status: 'pending',
          network: 'devnet',
          batchStartDate: new Date(),
          batchEndDate: new Date(),
        },
        { provider: 'rest' }
      );
      assert.fail('Should have thrown');
    } catch (error: any) {
      assert.ok(error);
    }
  });
});
