import { Service, SequelizeServiceOptions } from 'feathers-sequelize';
import { Params } from '@feathersjs/feathers';
import { Sequelize } from 'sequelize';
import type { Application, SolanaAnchor } from '../../declarations';
import { runAnchoring } from '../../cron/solana-anchoring';
import { submitMemoTransaction } from '../../utils/solana-client';
import logger from '../../logger';

const VERIFY_DELAY_MS = 1000;

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
      const anchors = Array.isArray(response) ? response : (response as any)?.data || [];

      // Reset all to unverified so the UI shows progress
      const ids = anchors.map((a: SolanaAnchor) => a.id);
      if (ids.length > 0) {
        const sequelize: Sequelize = this.app.get('sequelizeClient');
        await sequelize.models.solana_anchors.update(
          { verificationStatus: 'unverified', verifiedAt: null, verificationError: null },
          { where: { id: ids } },
        );
      }

      // Fire and forget — run in background
      this.runBatchVerification(anchors.map((a: SolanaAnchor) => a.id as string)).catch((err) => {
        logger.error('Batch verification failed', err);
      });

      return { ok: true, total: anchors.length };
    }

    return super.create(data, params);
  }

  private async runBatchVerification(anchorIds: string[]): Promise<void> {
    for (const anchorId of anchorIds) {
      try {
        await this.app.service('solana-anchor-verification').find({
          query: { anchorId },
        });
      } catch (err) {
        logger.error(`Verification failed for anchor ${anchorId}`, err);
      }

      // Delay between requests to avoid RPC rate limiting
      if (anchorId !== anchorIds[anchorIds.length - 1]) {
        await new Promise((r) => setTimeout(r, VERIFY_DELAY_MS));
      }
    }
  }
}
