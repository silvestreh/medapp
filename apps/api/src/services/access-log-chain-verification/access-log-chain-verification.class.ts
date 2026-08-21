import { BadRequest } from '@feathersjs/errors';
import type { Application } from '../../declarations';
import { computeAccessLogHash } from '../access-logs/hooks/access-log-hash';

export interface ChainVerificationResult {
  organizationId: string;
  totalLogs: number;
  verified: number;
  valid: boolean;
  brokenAt?: {
    logId: string;
    logDate: string;
    expectedHash: string;
    storedHash: string;
    position: number;
    reason: 'hash-mismatch' | 'missing-previous-log' | 'cycle';
  };
}

export class AccessLogChainVerification {
  app: Application;

  constructor(app: Application) {
    this.app = app;
  }

  async find(params: any): Promise<ChainVerificationResult> {
    const organizationId = params.query?.organizationId;
    if (!organizationId) {
      throw new BadRequest('organizationId query parameter is required');
    }

    const logs = await this.app.service('access-logs').find({
      query: {
        organizationId,
        $sort: { createdAt: 1, id: 1 },
      },
      paginate: false,
      provider: undefined
    }) as any[];

    // Timestamps can't order the chain (same-millisecond logs sort by random
    // UUID), so each log is verified against the log its previousLogId links
    // to. The (createdAt, id) sort is only used for stable position numbers.
    const sorted = (Array.isArray(logs) ? logs : []).sort((a, b) => {
      const dateCompare = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (dateCompare !== 0) return dateCompare;
      return String(a.id).localeCompare(String(b.id));
    });

    if (sorted.length === 0) {
      return {
        organizationId,
        totalLogs: 0,
        verified: 0,
        valid: true
      };
    }

    const byId = new Map<string, any>(sorted.map((log) => [String(log.id), log]));
    // Ids whose ancestry is already known to reach a chain start without looping
    const terminating = new Set<string>();
    let verified = 0;

    for (let i = 0; i < sorted.length; i++) {
      const log = sorted[i];

      // Skip pre-migration logs without hashes
      if (!log.hash) {
        verified++;
        continue;
      }

      let previousHash: string | null = null;

      if (log.previousLogId) {
        const previousLog = byId.get(String(log.previousLogId));

        // The linked previous log was deleted or belongs to another chain
        if (!previousLog) {
          return this.broken(organizationId, sorted.length, verified, log, i, '', 'missing-previous-log');
        }

        // Pre-migration previous logs have no hash; the chain starts fresh there
        previousHash = previousLog.hash || null;
      }

      const expectedHash = computeAccessLogHash(log, previousHash);

      if (expectedHash !== log.hash) {
        return this.broken(organizationId, sorted.length, verified, log, i, expectedHash, 'hash-mismatch');
      }

      if (!this.chainTerminates(log, byId, terminating)) {
        return this.broken(organizationId, sorted.length, verified, log, i, expectedHash, 'cycle');
      }

      verified++;
    }

    return {
      organizationId,
      totalLogs: sorted.length,
      verified,
      valid: true
    };
  }

  // Walks previousLogId links back from the given log to confirm the ancestry
  // reaches a chain start (no previous log, or a pre-migration log without a
  // hash) instead of looping. Already-checked ids short-circuit the walk.
  private chainTerminates(log: any, byId: Map<string, any>, terminating: Set<string>): boolean {
    const path: string[] = [];
    const visiting = new Set<string>();
    let current: any = log;

    while (current && current.hash) {
      const id = String(current.id);

      if (terminating.has(id)) break;
      if (visiting.has(id)) return false;

      visiting.add(id);
      path.push(id);
      current = current.previousLogId ? byId.get(String(current.previousLogId)) : undefined;
    }

    for (const id of path) {
      terminating.add(id);
    }

    return true;
  }

  private broken(
    organizationId: string,
    totalLogs: number,
    verified: number,
    log: any,
    position: number,
    expectedHash: string,
    reason: 'hash-mismatch' | 'missing-previous-log' | 'cycle'
  ): ChainVerificationResult {
    return {
      organizationId,
      totalLogs,
      verified,
      valid: false,
      brokenAt: {
        logId: log.id as string,
        logDate: new Date(log.createdAt).toISOString(),
        expectedHash,
        storedHash: log.hash,
        position,
        reason
      }
    };
  }
}
