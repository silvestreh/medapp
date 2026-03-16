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

    let previousHash: string | null = null;
    let verified = 0;

    for (let i = 0; i < sorted.length; i++) {
      const log = sorted[i];

      // Skip pre-migration logs without hashes
      if (!log.hash) {
        verified++;
        continue;
      }

      const expectedHash = computeAccessLogHash(log, previousHash);

      if (expectedHash !== log.hash) {
        return {
          organizationId,
          totalLogs: sorted.length,
          verified,
          valid: false,
          brokenAt: {
            logId: log.id as string,
            logDate: new Date(log.createdAt).toISOString(),
            expectedHash,
            storedHash: log.hash,
            position: i
          }
        };
      }

      previousHash = log.hash;
      verified++;
    }

    return {
      organizationId,
      totalLogs: sorted.length,
      verified,
      valid: true
    };
  }
}
