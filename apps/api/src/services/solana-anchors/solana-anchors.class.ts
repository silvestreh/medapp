import { Service, SequelizeServiceOptions } from 'feathers-sequelize';
import { Params } from '@feathersjs/feathers';
import { Sequelize } from 'sequelize';
import type { Application, SolanaAnchor, SolanaVerificationStatus } from '../../declarations';
import { runAnchoring } from '../../cron/solana-anchoring';
import { submitMemoTransaction, batchVerifyTransactions, BatchVerifyItem } from '../../utils/solana-client';
import logger from '../../logger';

export class SolanaAnchors extends Service<SolanaAnchor> {
  app: Application;

  constructor(options: Partial<SequelizeServiceOptions>, app: Application) {
    super(options);
    this.app = app;
  }

  async create(data: any, params?: Params): Promise<any> {
    if (data?.intent === 'trigger') {
      const result = await runAnchoring(this.app, submitMemoTransaction);
      return result;
    }

    if (data?.intent === 'verify-one') {
      const anchorId = data.anchorId;
      const result = await this.app.service('solana-anchor-verification').find({
        query: { anchorId },
      });
      return { ok: true, anchorId, result };
    }

    if (data?.intent === 'verify-all') {
      const response = await this.find({
        query: {
          status: 'confirmed',
          txSignature: { $ne: null },
          $sort: { createdAt: -1 },
          $limit: 200,
        },
        paginate: false,
      });
      const anchors: SolanaAnchor[] = Array.isArray(response) ? response : (response as any)?.data || [];

      // Reset all to unverified so the UI shows progress
      const ids = anchors.map((a) => a.id);
      if (ids.length > 0) {
        const sequelize: Sequelize = this.app.get('sequelizeClient');
        await sequelize.models.solana_anchors.update(
          { verificationStatus: 'unverified', verifiedAt: null, verificationError: null },
          { where: { id: ids } },
        );
      }

      // Fire and forget — run in background
      this.runBatchVerification(anchors).catch((err) => {
        logger.error('Batch verification failed', err);
      });

      return { ok: true, total: anchors.length };
    }

    return super.create(data, params);
  }

  private async runBatchVerification(anchors: SolanaAnchor[]): Promise<void> {
    const items: (BatchVerifyItem & { anchorId: string })[] = anchors
      .filter((a) => a.txSignature)
      .map((a) => ({
        anchorId: a.id as string,
        signature: a.txSignature!,
        expectedMerkleRoot: a.merkleRoot,
      }));

    const results = await batchVerifyTransactions(items);

    const sequelize: Sequelize = this.app.get('sequelizeClient');
    const AnchorModel = sequelize.models.solana_anchors;
    const now = new Date();

    for (let i = 0; i < results.length; i++) {
      const { result } = results[i];
      const { anchorId } = items[i];

      let verificationStatus: SolanaVerificationStatus = 'unverified';
      if (result.verified) {
        verificationStatus = 'verified';
      } else if (result.reason === 'not_found') {
        verificationStatus = 'inconclusive';
      } else {
        verificationStatus = 'mismatch';
      }

      try {
        await AnchorModel.update(
          {
            verificationStatus,
            verifiedAt: now,
            verificationError: result.verified ? null : (result.reason || null),
          },
          { where: { id: anchorId } },
        );
      } catch (err) {
        logger.error(`Failed to persist verification for anchor ${anchorId}`, err);
      }
    }
  }
}
