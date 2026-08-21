import cron from 'node-cron';
import { Op, Sequelize } from 'sequelize';
import { Application } from '../declarations';
import logger from '../logger';
import { getProvider } from '../services/payments/provider-registry';
import { isPaymentsConfigured } from '../utils/payments-config';
import { withTryXactLock } from '../utils/advisory-lock';
import type { PaymentConnections } from '../services/payment-connections/payment-connections.class';

// Refreshes delegated payment-processor tokens well before expiry (Mercado
// Pago access tokens last ~180 days and refresh invalidates the previous
// pair, so the new pair is stored atomically in one update). Repeated or
// terminal failures degrade the connection to `disconnected`, which
// automatically turns payment collection off for that professional — booking
// falls back to the normal unpaid path, never a broken one.

const MAX_REFRESH_RETRIES = 5;
const RETRY_BASE_MS = 30 * 60 * 1000;
const REFRESH_AHEAD_MS = 30 * 24 * 60 * 60 * 1000;
const JITTER_MAX_MS = 10 * 60 * 1000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isTerminalRefreshError = (error: unknown): boolean =>
  /invalid_grant|invalid grant/i.test(String((error as Error | undefined)?.message ?? ''));

export async function refreshPaymentTokens(app: Application): Promise<void> {
  const sequelize: Sequelize = app.get('sequelizeClient');
  const connectionsModel = sequelize.models.payment_connections;
  const service = app.service('payment-connections') as unknown as PaymentConnections;
  const now = new Date();

  const due = await connectionsModel.findAll({
    where: {
      status: { [Op.in]: ['connected', 'refresh_failed'] },
      expiresAt: { [Op.lt]: new Date(now.getTime() + REFRESH_AHEAD_MS) },
      [Op.or]: [
        { nextRefreshRetry: null },
        { nextRefreshRetry: { [Op.lt]: now } },
      ],
    },
    attributes: ['userId'],
    raw: true,
  }) as unknown as Array<{ userId: string }>;

  for (const { userId } of due) {
    const connection = await service.getDecryptedCredentials(userId);

    if (!connection) {
      continue;
    }

    try {
      const provider = getProvider(connection.provider);
      const refreshed = await provider.refreshCredentials(connection);

      await service.storeCredentials(userId, connection.provider, refreshed, { logEvent: false });
      logger.info(`Payment token refresh: refreshed connection for user ${userId}`);
    } catch (error: any) {
      const failCount = (connection.refreshFailCount ?? 0) + 1;

      if (isTerminalRefreshError(error) || failCount >= MAX_REFRESH_RETRIES) {
        await service.markConnectionStatus(userId, 'disconnected', {
          refreshFailCount: failCount,
          nextRefreshRetry: null,
        });
        app.service('access-logs').create({
          userId,
          organizationId: null,
          resource: 'payment-connection',
          action: 'deny',
          purpose: 'billing',
          patientId: null,
          metadata: { event: 'refresh-failed-disconnected', failCount },
        }, { provider: undefined }).catch(() => undefined);
        logger.warn(
          `Payment token refresh: connection for user ${userId} disconnected (${isTerminalRefreshError(error) ? 'grant revoked' : `${failCount} failed retries`})`
        );
      } else {
        const backoffMs = RETRY_BASE_MS * 2 ** (failCount - 1);
        await service.markConnectionStatus(userId, 'refresh_failed', {
          refreshFailCount: failCount,
          nextRefreshRetry: new Date(Date.now() + backoffMs),
        });
        logger.info(
          `Payment token refresh: user ${userId} retry ${failCount}/${MAX_REFRESH_RETRIES} scheduled in ${Math.round(backoffMs / 60000)}min`
        );
      }
    }
  }
}

export function schedulePaymentTokenRefresh(app: Application): void {
  cron.schedule(process.env.PAYMENT_TOKEN_REFRESH_CRON || '0 * * * *', async () => {
    if (!isPaymentsConfigured(app)) {
      return;
    }

    // One jitter per run, BEFORE taking the lock, so instances don't all hit
    // the provider at the top of the hour and no transaction sits open while
    // we wait.
    await sleep(Math.floor(Math.random() * JITTER_MAX_MS));

    try {
      await withTryXactLock(app.get('sequelizeClient'), 'payment-token-refresh', () => refreshPaymentTokens(app));
    } catch (error: any) {
      logger.error('Payment token refresh failed: %s', error?.message);
    }
  });
}
