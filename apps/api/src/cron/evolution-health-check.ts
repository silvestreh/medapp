import cron from 'node-cron';
import { Sequelize } from 'sequelize';
import { Application } from '../declarations';
import logger from '../logger';
import Sentry from '../sentry';
import {
  checkInstanceConnected,
  type InstanceConnectionResult,
} from '../services/whatsapp/utils/check-instance-connected';
import { getWhatsappQueue } from '../queues/whatsapp-queue';
import { redeployRailwayService, type RedeployResult } from '../utils/railway';

interface InstanceState {
  organizationId: string;
  instanceName: string;
  consecutiveFailures: number;
}

const ALERT_THRESHOLD = 2;
const REDEPLOY_THRESHOLD = 3;

const stateByInstance = new Map<string, InstanceState>();

export function resetHealthCheckStateForTesting(): void {
  stateByInstance.clear();
}

export type CheckFn = (app: Application, organizationId: string) => Promise<InstanceConnectionResult>;
export type RedeployFn = () => Promise<RedeployResult>;
export type PromoteFn = () => Promise<number>;

export interface HealthCheckOptions {
  checkFn?: CheckFn;
  redeployFn?: RedeployFn;
  promoteFn?: PromoteFn;
}

async function findOrgsWithWhatsapp(app: Application): Promise<Array<{ id: string; instanceName: string }>> {
  const sequelize: Sequelize = app.get('sequelizeClient');
  const orgs = await sequelize.models.organizations.findAll({
    attributes: ['id', 'settings'],
    raw: true,
  }) as any[];
  return orgs
    .filter((o) => o.settings?.whatsapp?.instanceName)
    .map((o) => ({ id: o.id, instanceName: o.settings.whatsapp.instanceName }));
}

async function defaultPromoteDelayedJobs(): Promise<number> {
  const queue = getWhatsappQueue();
  if (!queue) return 0;
  try {
    const delayed = await queue.getDelayed();
    let promoted = 0;
    for (const job of delayed) {
      try {
        await job.promote();
        promoted++;
      } catch {
        // Already promoted or completed — non-fatal
      }
    }
    if (promoted > 0) {
      logger.info(`[Evolution Health] Promoted ${promoted} delayed jobs after recovery`);
    }
    return promoted;
  } catch (err: any) {
    logger.warn(`[Evolution Health] Could not promote delayed jobs: ${err.message}`);
    return 0;
  }
}

export async function runEvolutionHealthCheck(
  app: Application,
  options: HealthCheckOptions = {}
): Promise<void> {
  const checkFn = options.checkFn || checkInstanceConnected;
  const redeployFn = options.redeployFn || redeployRailwayService;
  const promoteFn = options.promoteFn || defaultPromoteDelayedJobs;

  const orgs = await findOrgsWithWhatsapp(app);
  if (orgs.length === 0) return;

  let anyRecovered = false;
  let failureCount = 0;

  for (const org of orgs) {
    const key = `${org.id}:${org.instanceName}`;
    const prev = stateByInstance.get(key) || {
      organizationId: org.id,
      instanceName: org.instanceName,
      consecutiveFailures: 0,
    };

    let result: InstanceConnectionResult;
    try {
      result = await checkFn(app, org.id);
    } catch (err: any) {
      logger.warn(`[Evolution Health] check threw for org ${org.id}: ${err.message}`);
      result = { ok: false, connected: false, instanceName: org.instanceName, reason: 'evolution-unreachable' };
    }

    const reachable = result.ok && result.connected;

    if (reachable) {
      if (prev.consecutiveFailures > 0) {
        logger.info(`[Evolution Health] Recovered for org ${org.id} after ${prev.consecutiveFailures} failure(s)`);
        anyRecovered = true;
      }
      stateByInstance.set(key, { ...prev, consecutiveFailures: 0 });
      continue;
    }

    failureCount++;
    const next: InstanceState = { ...prev, consecutiveFailures: prev.consecutiveFailures + 1 };
    stateByInstance.set(key, next);

    logger.warn(
      `[Evolution Health] Failure ${next.consecutiveFailures} for org ${org.id} (${result.reason || 'unknown'})`
    );

    if (next.consecutiveFailures === ALERT_THRESHOLD) {
      Sentry.captureMessage('Evolution API unreachable', {
        level: 'error',
        tags: { feature: 'whatsapp', organizationId: org.id, instanceName: org.instanceName },
        extra: { reason: result.reason, consecutiveFailures: next.consecutiveFailures },
      });
    }
  }

  if (anyRecovered) {
    await promoteFn();
  }

  const someoneOverRedeployThreshold = Array.from(stateByInstance.values()).some(
    (s) => s.consecutiveFailures >= REDEPLOY_THRESHOLD
  );
  if (someoneOverRedeployThreshold && failureCount > 0) {
    await redeployFn();
  }
}

export function scheduleEvolutionHealthCheck(app: Application): void {
  const schedule = process.env.EVOLUTION_HEALTH_CHECK_CRON || '*/2 * * * *';
  cron.schedule(schedule, () => {
    runEvolutionHealthCheck(app).catch((err) => {
      logger.error(`[Evolution Health] Cron error: ${err.message}`);
      Sentry.captureException(err, { tags: { feature: 'whatsapp', step: 'health-check-cron' } });
    });
  });
  logger.info(`Scheduled Evolution health check (${schedule})`);
}
