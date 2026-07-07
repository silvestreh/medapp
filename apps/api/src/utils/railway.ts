import logger from '../logger';
import Sentry from '../sentry';

const RAILWAY_GRAPHQL_URL = 'https://backboard.railway.com/graphql/v2';
const COOLDOWN_MS = 10 * 60 * 1000;

let lastRedeployAt = 0;

export interface RedeployResult {
  ok: boolean;
  reason?: 'not-configured' | 'cooldown' | 'request-failed' | 'graphql-error';
  status?: number;
}

export function shouldRedeploy(): boolean {
  return Date.now() - lastRedeployAt >= COOLDOWN_MS;
}

export function timeSinceLastRedeployMs(): number {
  return Date.now() - lastRedeployAt;
}

export function resetRailwayCooldownForTesting(): void {
  lastRedeployAt = 0;
}

export async function redeployRailwayService(): Promise<RedeployResult> {
  const token = process.env.RAILWAY_API_TOKEN;
  const serviceId = process.env.RAILWAY_EVOLUTION_SERVICE_ID;
  const environmentId = process.env.RAILWAY_EVOLUTION_ENVIRONMENT_ID;

  if (!token || !serviceId || !environmentId) {
    logger.warn('[Railway] Redeploy skipped: missing RAILWAY_API_TOKEN / SERVICE_ID / ENVIRONMENT_ID');
    return { ok: false, reason: 'not-configured' };
  }

  if (!shouldRedeploy()) {
    const remainingMs = COOLDOWN_MS - timeSinceLastRedeployMs();
    logger.info(`[Railway] Redeploy skipped: cooldown active (${Math.ceil(remainingMs / 1000)}s remaining)`);
    return { ok: false, reason: 'cooldown' };
  }

  const query = `mutation serviceInstanceRedeploy($serviceId: String!, $environmentId: String!) {
    serviceInstanceRedeploy(serviceId: $serviceId, environmentId: $environmentId)
  }`;

  let response: Response;
  try {
    response = await fetch(`${RAILWAY_GRAPHQL_URL}?serviceInstanceRedeploy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        query,
        variables: { serviceId, environmentId },
      }),
    });
  } catch (err: any) {
    logger.error(`[Railway] Redeploy request error: ${err.message}`);
    Sentry.captureException(err, { tags: { feature: 'railway-redeploy' } });
    return { ok: false, reason: 'request-failed' };
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    logger.error(`[Railway] Redeploy failed: ${response.status} ${body.slice(0, 200)}`);
    Sentry.captureMessage(`Railway redeploy HTTP ${response.status}`, {
      level: 'error',
      tags: { feature: 'railway-redeploy' },
      extra: { status: response.status, body: body.slice(0, 500) },
    });
    return { ok: false, reason: 'request-failed', status: response.status };
  }

  const body = await response.json() as any;
  if (body?.errors?.length) {
    logger.error(`[Railway] Redeploy GraphQL errors: ${JSON.stringify(body.errors)}`);
    Sentry.captureMessage('Railway redeploy GraphQL error', {
      level: 'error',
      tags: { feature: 'railway-redeploy' },
      extra: { errors: body.errors },
    });
    return { ok: false, reason: 'graphql-error' };
  }

  lastRedeployAt = Date.now();
  logger.warn('[Railway] Evolution service redeploy triggered');
  Sentry.captureMessage('Evolution service redeploy triggered', {
    level: 'warning',
    tags: { feature: 'railway-redeploy' },
    extra: { serviceId, environmentId },
  });
  return { ok: true, status: response.status };
}
