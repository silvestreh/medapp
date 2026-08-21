import cron from 'node-cron';
import { Op, QueryTypes, Sequelize, Transaction } from 'sequelize';
import { Application } from '../declarations';
import logger from '../logger';

// Proactive sweep for payment holds. Read-time checks (booking create(), the
// patient's payment-status poll, and the slot grid) are the authoritative
// enforcement; this job frees lapsed holds for everyone else's availability
// queries, expires stale payment offers, cleans up long-dead hold rows, and
// purges old OAuth state rows.
//
// Expired appointment rows are kept for a grace window (not deleted on the
// spot) because a late-arriving approved webhook can still resurrect one
// while its slot remains free.

const EXPIRED_ROW_RETENTION_MS = 24 * 60 * 60 * 1000;

export async function runPaymentHoldExpiry(app: Application): Promise<void> {
  const now = new Date();
  const internal = { provider: undefined } as const;

  // 1. Lapsed required-mode holds release their slot.
  await (app.service('appointments') as any).patch(null, { status: 'expired' }, {
    query: {
      status: 'pending_payment',
      holdExpiresAt: { $lt: now.toISOString() },
    },
    ...internal,
  });

  // 2. Stale open payment offers (both modes) expire; in optional mode the
  //    appointment stays confirmed and the patient simply pays in person.
  await app.service('appointment-payments').patch(null, { status: 'expired' }, {
    query: {
      status: { $in: ['pending', 'in_process'] },
      expiresAt: { $lt: now.toISOString() },
    },
    ...internal,
  });

  // 3. Drop expired hold rows past the resurrect grace window (the linked
  //    payment row survives via its denormalized snapshot + SET NULL FK).
  const sequelize: Sequelize = app.get('sequelizeClient');
  await sequelize.models.appointments.destroy({
    where: {
      status: 'expired',
      holdExpiresAt: { [Op.lt]: new Date(now.getTime() - EXPIRED_ROW_RETENTION_MS) },
    },
  });

  // 4. Purge stale single-use OAuth states.
  await sequelize.models.payment_oauth_states.destroy({
    where: { expiresAt: { [Op.lt]: new Date(now.getTime() - 60 * 60 * 1000) } },
  });
}

async function acquireLock(sequelize: Sequelize, transaction: Transaction): Promise<boolean> {
  try {
    const [row] = await sequelize.query(
      'SELECT pg_try_advisory_xact_lock(hashtext(\'payment-hold-expiry\')) AS locked',
      { type: QueryTypes.SELECT, transaction }
    ) as Array<{ locked: boolean }>;
    return row?.locked === true;
  } catch {
    return false;
  }
}

export function schedulePaymentHoldExpiry(app: Application): void {
  cron.schedule(process.env.PAYMENT_HOLD_EXPIRY_CRON || '* * * * *', async () => {
    const sequelize: Sequelize = app.get('sequelizeClient');
    const transaction = await sequelize.transaction();

    try {
      if (!(await acquireLock(sequelize, transaction))) {
        return;
      }

      await runPaymentHoldExpiry(app);
    } catch (error: any) {
      logger.error('Payment hold expiry failed: %s', error?.message);
    } finally {
      try {
        await transaction.rollback();
      } catch {
        // Lock release failure is not critical
      }
    }
  });
}
