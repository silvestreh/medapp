import assert from 'assert';
import app from '../../src/app';
import {
  runEvolutionHealthCheck,
  resetHealthCheckStateForTesting,
  type CheckFn,
} from '../../src/cron/evolution-health-check';
import { createTestOrganization } from '../test-helpers';
import type { InstanceConnectionResult } from '../../src/services/whatsapp/utils/check-instance-connected';

function ok(instanceName: string): InstanceConnectionResult {
  return { ok: true, connected: true, instanceName };
}

function fail(instanceName: string): InstanceConnectionResult {
  return { ok: false, connected: false, instanceName, reason: 'evolution-unreachable' };
}

describe('Evolution health check cron', function () {
  this.timeout(15000);

  let orgId: string;
  const instanceName = `test-instance-${Date.now()}`;

  // Wraps a per-org checkFn so other orgs that may exist in the test DB
  // (e.g. from prior tests) report healthy and don't interfere.
  function scoped(perOrgFn: () => InstanceConnectionResult): CheckFn {
    return async (_app, organizationId) => {
      if (organizationId === orgId) return perOrgFn();
      return { ok: true, connected: true, instanceName: 'other' };
    };
  }

  before(async () => {
    const org = await createTestOrganization();
    orgId = String(org.id);
    await app.service('organizations').patch(orgId, {
      settings: {
        whatsapp: {
          instanceName,
          instanceId: instanceName,
          connected: true,
        },
      },
    } as any);
  });

  beforeEach(() => {
    resetHealthCheckStateForTesting();
  });

  it('clears state on successful check (no alerts, no redeploy)', async () => {
    let redeployCalls = 0;
    let promoteCalls = 0;

    await runEvolutionHealthCheck(app, {
      checkFn: scoped(() => ok(instanceName)),
      redeployFn: async () => { redeployCalls++; return { ok: true }; },
      promoteFn: async () => { promoteCalls++; return 0; },
    });

    assert.strictEqual(redeployCalls, 0);
    assert.strictEqual(promoteCalls, 0);
  });

  it('does not redeploy on a single failure', async () => {
    let redeployCalls = 0;

    await runEvolutionHealthCheck(app, {
      checkFn: scoped(() => fail(instanceName)),
      redeployFn: async () => { redeployCalls++; return { ok: true }; },
      promoteFn: async () => 0,
    });

    assert.strictEqual(redeployCalls, 0);
  });

  it('redeploys after 3 consecutive failures', async () => {
    let redeployCalls = 0;
    const checkFn = scoped(() => fail(instanceName));
    const redeployFn = async () => { redeployCalls++; return { ok: true as const }; };
    const promoteFn = async () => 0;

    await runEvolutionHealthCheck(app, { checkFn, redeployFn, promoteFn });
    await runEvolutionHealthCheck(app, { checkFn, redeployFn, promoteFn });
    assert.strictEqual(redeployCalls, 0, 'no redeploy after 2 failures');

    await runEvolutionHealthCheck(app, { checkFn, redeployFn, promoteFn });
    assert.strictEqual(redeployCalls, 1, 'redeploy after 3rd consecutive failure');
  });

  it('promotes delayed jobs on recovery and clears state', async () => {
    let promoteCalls = 0;
    let tick = 0;
    const checkFn = scoped(() => (++tick <= 2 ? fail(instanceName) : ok(instanceName)));
    const promoteFn = async () => { promoteCalls++; return 3; };
    const redeployFn = async () => ({ ok: true as const });

    await runEvolutionHealthCheck(app, { checkFn, redeployFn, promoteFn });
    await runEvolutionHealthCheck(app, { checkFn, redeployFn, promoteFn });
    assert.strictEqual(promoteCalls, 0, 'no promote during failures');

    await runEvolutionHealthCheck(app, { checkFn, redeployFn, promoteFn });
    assert.strictEqual(promoteCalls, 1, 'promote called once on recovery');

    await runEvolutionHealthCheck(app, { checkFn, redeployFn, promoteFn });
    assert.strictEqual(promoteCalls, 1, 'no extra promote when already healthy');
  });

  it('does not redeploy once instance recovers', async () => {
    let redeployCalls = 0;
    let tick = 0;
    const checkFn = scoped(() => (++tick <= 2 ? fail(instanceName) : ok(instanceName)));

    for (let i = 0; i < 3; i++) {
      await runEvolutionHealthCheck(app, {
        checkFn,
        redeployFn: async () => { redeployCalls++; return { ok: true }; },
        promoteFn: async () => 0,
      });
    }

    assert.strictEqual(redeployCalls, 0);
  });
});
