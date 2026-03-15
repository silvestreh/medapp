/**
 * Backfill script to compute hash chains for existing encounters.
 *
 * Usage: npx ts-node -r dotenv/config src/scripts/backfill-encounter-hashes.ts
 *
 * This script:
 * 1. Fetches all encounters grouped by patientId
 * 2. Sorts each patient's encounters by date ASC, id ASC
 * 3. Computes the hash chain and sets hash + previousEncounterId
 */
import dotenv from 'dotenv';
dotenv.config();

import feathers from '@feathersjs/feathers';
import express from '@feathersjs/express';
import configuration from '@feathersjs/configuration';
import { Application } from '../declarations';
import sequelize from '../sequelize';
import services from '../services';
import { computeEncounterHash } from '../services/encounters/hooks/encounter-hash';

async function main() {
  const app: Application = express(feathers());
  app.configure(configuration());
  app.configure(sequelize);
  app.configure(services);
  await app.setup();

  // Wait for sequelize sync
  await app.get('sequelizeSync');

  const sequelizeClient = app.get('sequelizeClient');

  console.log('Fetching all encounters...');

  // Fetch all encounters with decrypted data using internal call
  const allEncounters = await app.service('encounters').find({
    query: {
      $sort: { date: 1, id: 1 },
      $limit: -1
    },
    paginate: false,
    provider: undefined
  }) as any[];

  const encounters = Array.isArray(allEncounters) ? allEncounters : [];
  console.log(`Found ${encounters.length} total encounters.`);

  // Group by patientId
  const byPatient = new Map<string, any[]>();
  for (const enc of encounters) {
    const pid = enc.patientId;
    if (!byPatient.has(pid)) byPatient.set(pid, []);
    byPatient.get(pid)!.push(enc);
  }

  console.log(`Processing ${byPatient.size} patients...`);

  let patientsProcessed = 0;
  let encountersUpdated = 0;

  for (const [, patientEncounters] of byPatient) {
    // Sort by date ASC, id ASC
    patientEncounters.sort((a: any, b: any) => {
      const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (dateCompare !== 0) return dateCompare;
      return String(a.id).localeCompare(String(b.id));
    });

    let previousHash: string | null = null;
    let previousId: string | null = null;

    for (const encounter of patientEncounters) {
      const hash = computeEncounterHash(encounter, previousHash);

      // Update using raw query to avoid triggering hooks and encryption
      await sequelizeClient.query(
        'UPDATE encounters SET hash = :hash, "previousEncounterId" = :previousEncounterId WHERE id = :id',
        {
          replacements: {
            hash,
            previousEncounterId: previousId,
            id: encounter.id
          }
        }
      );

      previousHash = hash;
      previousId = encounter.id;
      encountersUpdated++;
    }

    patientsProcessed++;
    if (patientsProcessed % 100 === 0) {
      console.log(`  Processed ${patientsProcessed}/${byPatient.size} patients (${encountersUpdated} encounters updated)`);
    }
  }

  console.log(`Done! Processed ${patientsProcessed} patients, updated ${encountersUpdated} encounters.`);

  await sequelizeClient.close();
  process.exit(0);
}

main().catch((error) => {
  console.error('Backfill failed:', error);
  process.exit(1);
});
