import cron from 'node-cron';
import { Sequelize, QueryTypes, Op } from 'sequelize';
import { Application } from '../declarations';
import logger from '../logger';
import Sentry from '../sentry';
import { buildMerkleTree } from '../utils/merkle-tree';
import {
  getSolanaKeypair,
  getSolanaNetwork,
  getWalletBalance,
  submitMemoTransaction,
  MemoSubmissionResult,
} from '../utils/solana-client';

type SubmitFn = (merkleRoot: string, metadata: { type: string; count: number }) => Promise<MemoSubmissionResult>;

interface SolanaAnchoringOptions {
  submitFn?: SubmitFn;
}

const MAX_RETRIES = 5;
const LOW_BALANCE_THRESHOLD = 0.01;

async function acquireLock(sequelize: Sequelize): Promise<boolean> {
  try {
    await sequelize.query("SELECT pg_advisory_lock(hashtext('solana-anchoring'))", {
      type: QueryTypes.SELECT,
    });
    return true;
  } catch {
    return false;
  }
}

async function releaseLock(sequelize: Sequelize): Promise<void> {
  try {
    await sequelize.query("SELECT pg_advisory_unlock(hashtext('solana-anchoring'))", {
      type: QueryTypes.SELECT,
    });
  } catch {
    // Lock release failure is not critical
  }
}

interface UnanchoredRecord {
  id: string;
  hash: string;
  date: string;
}

async function fetchUnanchoredRecords(
  sequelize: Sequelize,
  tableName: string,
  dateColumn: string
): Promise<UnanchoredRecord[]> {
  const records = await sequelize.query<UnanchoredRecord>(
    `SELECT t.id, t.hash, t."${dateColumn}" as date
     FROM "${tableName}" t
     LEFT JOIN solana_anchor_leaves sal ON sal."recordId" = t.id
     WHERE t.hash IS NOT NULL AND sal.id IS NULL
     ORDER BY t."${dateColumn}" ASC, t.id ASC`,
    { type: QueryTypes.SELECT }
  );
  return records;
}

async function retryFailedAnchors(
  sequelize: Sequelize,
  submitFn: SubmitFn
): Promise<void> {
  const AnchorModel = sequelize.models.solana_anchors;
  const failedAnchors = await AnchorModel.findAll({
    where: {
      status: 'failed',
      retryCount: { [Op.lt]: MAX_RETRIES },
    },
    raw: true,
  }) as any[];

  for (const anchor of failedAnchors) {
    try {
      const result = await submitFn(anchor.merkleRoot, {
        type: anchor.chainType,
        count: anchor.leafCount,
      });

      await AnchorModel.update(
        {
          status: 'confirmed',
          txSignature: result.signature,
          slot: result.slot,
          errorMessage: null,
        },
        { where: { id: anchor.id } }
      );

      logger.info(`Solana anchoring: retried and confirmed anchor ${anchor.id} (tx: ${result.signature})`);
    } catch (error: any) {
      await AnchorModel.update(
        {
          retryCount: anchor.retryCount + 1,
          errorMessage: error.message || 'Unknown error',
        },
        { where: { id: anchor.id } }
      );

      logger.warn(`Solana anchoring: retry failed for anchor ${anchor.id} (attempt ${anchor.retryCount + 1}/${MAX_RETRIES})`);

      if (anchor.retryCount + 1 >= MAX_RETRIES) {
        Sentry.captureException(error, {
          tags: { component: 'solana-anchoring' },
          extra: { anchorId: anchor.id, chainType: anchor.chainType, retryCount: anchor.retryCount + 1 },
        });
      }
    }
  }
}

async function anchorChain(
  sequelize: Sequelize,
  chainType: 'encounters' | 'access_logs',
  tableName: string,
  dateColumn: string,
  submitFn: SubmitFn
): Promise<void> {
  const records = await fetchUnanchoredRecords(sequelize, tableName, dateColumn);

  if (records.length === 0) {
    return;
  }

  const hashes = records.map((r) => r.hash);
  const tree = buildMerkleTree(hashes);
  const network = getSolanaNetwork();

  const dates = records.map((r) => new Date(r.date));
  const batchStartDate = new Date(Math.min(...dates.map((d) => d.getTime())));
  const batchEndDate = new Date(Math.max(...dates.map((d) => d.getTime())));

  const AnchorModel = sequelize.models.solana_anchors;
  const LeafModel = sequelize.models.solana_anchor_leaves;

  // Create the anchor record
  const anchor = await AnchorModel.create({
    merkleRoot: tree.root,
    leafCount: records.length,
    chainType,
    status: 'pending',
    network,
    batchStartDate,
    batchEndDate,
  }) as any;

  // Create leaf records
  const leafRecords = records.map((record, index) => ({
    anchorId: anchor.id,
    recordId: record.id,
    recordHash: record.hash,
    leafIndex: index,
  }));

  await LeafModel.bulkCreate(leafRecords);

  // Submit to Solana
  try {
    const result = await submitFn(tree.root, {
      type: chainType,
      count: records.length,
    });

    await AnchorModel.update(
      {
        status: 'confirmed',
        txSignature: result.signature,
        slot: result.slot,
      },
      { where: { id: anchor.id } }
    );

    logger.info(
      `Solana anchoring: confirmed ${chainType} anchor with ${records.length} records (root: ${tree.root}, tx: ${result.signature})`
    );
  } catch (error: any) {
    await AnchorModel.update(
      {
        status: 'failed',
        errorMessage: error.message || 'Unknown error',
      },
      { where: { id: anchor.id } }
    );

    logger.warn(`Solana anchoring: failed to submit ${chainType} anchor (root: ${tree.root}): ${error.message}`);
    Sentry.captureException(error, {
      tags: { component: 'solana-anchoring' },
      extra: { chainType, merkleRoot: tree.root, leafCount: records.length },
    });
  }
}

export interface AnchoringResult {
  ok: boolean;
  error?: string;
  encountersAnchored?: number;
  accessLogsAnchored?: number;
  balance?: number | null;
}

async function runAnchoring(app: Application, submitFn: SubmitFn): Promise<AnchoringResult> {
  const keypair = getSolanaKeypair();
  if (!keypair) {
    return { ok: false, error: 'SOLANA_KEYPAIR is not configured or is malformed' };
  }

  const sequelize: Sequelize = app.get('sequelizeClient');

  const locked = await acquireLock(sequelize);
  if (!locked) {
    logger.warn('Solana anchoring: could not acquire lock, skipping cycle');
    return { ok: false, error: 'Could not acquire database lock — another anchoring may be in progress' };
  }

  try {
    // Retry failed anchors first
    await retryFailedAnchors(sequelize, submitFn);

    // Anchor new encounters
    await anchorChain(sequelize, 'encounters', 'encounters', 'date', submitFn);

    // Anchor new access logs
    await anchorChain(sequelize, 'access_logs', 'access_logs', 'createdAt', submitFn);

    // Check wallet balance
    const balance = await getWalletBalance();
    if (balance !== null && balance < LOW_BALANCE_THRESHOLD) {
      const msg = `Solana anchoring: wallet balance is low (${balance} SOL). Please fund the wallet.`;
      logger.warn(msg);
      Sentry.captureMessage(msg, {
        level: 'warning',
        tags: { component: 'solana-anchoring' },
        extra: { balance, threshold: LOW_BALANCE_THRESHOLD },
      });
    }
    if (balance === 0) {
      const err = new Error(`Solana anchoring: wallet is out of funds (0 SOL)`);
      logger.error(err.message);
      Sentry.captureException(err, {
        tags: { component: 'solana-anchoring' },
      });
    }

    return { ok: true, balance };
  } catch (error: any) {
    logger.error(`Solana anchoring: unexpected error: ${error.message}`);
    Sentry.captureException(error, {
      tags: { component: 'solana-anchoring' },
    });
    return { ok: false, error: error.message };
  } finally {
    await releaseLock(sequelize);
  }
}

export function scheduleSolanaAnchoring(app: Application, options?: SolanaAnchoringOptions): void {
  const keypair = getSolanaKeypair();
  if (!keypair) {
    logger.info('Solana anchoring disabled: no keypair configured');
    return;
  }

  const submitFn = options?.submitFn || submitMemoTransaction;
  const schedule = process.env.SOLANA_ANCHOR_CRON || '0 * * * *';
  const network = getSolanaNetwork();

  logger.info(`Solana anchoring enabled on ${network} (wallet: ${keypair.publicKey.toBase58()})`);

  // Check initial balance
  getWalletBalance().then((balance) => {
    if (balance !== null) {
      logger.info(`Solana anchoring: wallet balance is ${balance} SOL`);
      if (balance === 0) {
        const err = new Error('Solana anchoring: wallet is out of funds (0 SOL) at startup');
        logger.error(err.message);
        Sentry.captureException(err, { tags: { component: 'solana-anchoring' } });
      } else if (balance < LOW_BALANCE_THRESHOLD) {
        const msg = `Solana anchoring: wallet balance is low at startup (${balance} SOL)`;
        logger.warn(msg);
        Sentry.captureMessage(msg, {
          level: 'warning',
          tags: { component: 'solana-anchoring' },
          extra: { balance },
        });
      }
    }
  }).catch((error) => {
    logger.warn('Solana anchoring: could not check wallet balance');
    Sentry.captureException(error, { tags: { component: 'solana-anchoring' } });
  });

  cron.schedule(schedule, () => {
    runAnchoring(app, submitFn).catch((error) => {
      logger.error(`Solana anchoring cron error: ${error.message}`);
    });
  });

  logger.info(`Scheduled Solana anchoring (${schedule})`);
}

// Export for testing
export { runAnchoring };
