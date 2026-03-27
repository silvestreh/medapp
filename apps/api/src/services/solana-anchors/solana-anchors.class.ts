import { Service, SequelizeServiceOptions } from 'feathers-sequelize';
import { Params } from '@feathersjs/feathers';
import type { Application, SolanaAnchor, SolanaVerificationStatus } from '../../declarations';
import { runAnchoring } from '../../cron/solana-anchoring';
import { submitMemoTransaction, verifyMemoTransaction } from '../../utils/solana-client';
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
      const response = await this.app.service('solana-anchors').find({
        query: {
          status: 'confirmed',
          txSignature: { $ne: null },
          $sort: { createdAt: -1 },
        },
        paginate: false,
      });
      const anchors: SolanaAnchor[] = Array.isArray(response) ? response : (response as any)?.data || [];

      // Reset all to unverified so the UI shows progress
      for (const anchor of anchors) {
        await this.app.service('solana-anchors').patch(anchor.id, {
          verificationStatus: 'unverified',
          verifiedAt: null,
          verificationError: null,
        });
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
    const CHUNK_SIZE = 5;
    const CHUNK_DELAY_MS = 1500;

    const items = anchors
      .filter((a) => a.txSignature)
      .map((a) => ({
        anchorId: a.id as string,
        signature: a.txSignature!,
        expectedMerkleRoot: a.merkleRoot,
      }));

    for (let i = 0; i < items.length; i += CHUNK_SIZE) {
      const chunk = items.slice(i, i + CHUNK_SIZE);

      // Verify chunk concurrently
      const results = await Promise.all(
        chunk.map((item) => verifyMemoTransaction(item.signature, item.expectedMerkleRoot)),
      );

      // Write this chunk's results to DB immediately
      const now = new Date();
      for (let j = 0; j < chunk.length; j++) {
        const result = results[j];
        const { anchorId } = chunk[j];

        let verificationStatus: SolanaVerificationStatus = 'unverified';
        if (result.verified) {
          verificationStatus = 'verified';
        } else if (result.reason === 'not_found') {
          verificationStatus = 'inconclusive';
        } else {
          verificationStatus = 'mismatch';
        }

        try {
          await this.app.service('solana-anchors').patch(anchorId, {
            verificationStatus,
            verifiedAt: now,
            verificationError: result.verified ? null : (result.reason || null),
          });
        } catch (err) {
          logger.error(`Failed to persist verification for anchor ${anchorId}`, err);
        }
      }

      // Delay between chunks
      if (i + CHUNK_SIZE < items.length) {
        await new Promise((r) => setTimeout(r, CHUNK_DELAY_MS));
      }
    }
  }
}
