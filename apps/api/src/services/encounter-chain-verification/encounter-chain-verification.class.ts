import { BadRequest } from '@feathersjs/errors';
import type { Application, Encounter } from '../../declarations';
import { computeEncounterHash } from '../encounters/hooks/encounter-hash';

export interface ChainVerificationResult {
  patientId: string;
  totalEncounters: number;
  verified: number;
  valid: boolean;
  brokenAt?: {
    encounterId: string;
    encounterDate: string;
    expectedHash: string;
    storedHash: string;
    position: number;
  };
}

export class EncounterChainVerification {
  app: Application;

  constructor(app: Application) {
    this.app = app;
  }

  async find(params: any): Promise<ChainVerificationResult> {
    const patientId = params.query?.patientId;
    if (!patientId) {
      throw new BadRequest('patientId query parameter is required');
    }

    // Fetch all encounters for this patient with decrypted data (internal call)
    const encounters = await this.app.service('encounters').find({
      query: {
        patientId,
        $sort: { date: 1, id: 1 },
      },
      paginate: false,
      provider: undefined
    }) as Encounter[];

    const sorted = (Array.isArray(encounters) ? encounters : []).sort((a, b) => {
      const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (dateCompare !== 0) return dateCompare;
      return String(a.id).localeCompare(String(b.id));
    });

    if (sorted.length === 0) {
      return {
        patientId,
        totalEncounters: 0,
        verified: 0,
        valid: true
      };
    }

    let previousHash: string | null = null;
    let verified = 0;

    for (let i = 0; i < sorted.length; i++) {
      const encounter = sorted[i];

      // Skip pre-backfill encounters without hashes
      if (!encounter.hash) {
        verified++;
        continue;
      }

      const expectedHash = computeEncounterHash(encounter, previousHash);

      if (expectedHash !== encounter.hash) {
        return {
          patientId,
          totalEncounters: sorted.length,
          verified,
          valid: false,
          brokenAt: {
            encounterId: encounter.id as string,
            encounterDate: new Date(encounter.date).toISOString(),
            expectedHash,
            storedHash: encounter.hash,
            position: i
          }
        };
      }

      previousHash = encounter.hash;
      verified++;
    }

    return {
      patientId,
      totalEncounters: sorted.length,
      verified,
      valid: true
    };
  }
}
