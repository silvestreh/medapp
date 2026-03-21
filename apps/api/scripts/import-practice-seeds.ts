import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import app from '../src/app';

const ORG_SLUG = 'hematologia-herrera';
const JUANCA_ID = '540dc81947771d1f3f8b4567';

interface PracticeSeed {
  insurerId: string;
  practiceKey: string;
  isSystem: boolean;
  code: string;
  description: string;
}

interface PrepagaSeedEntry {
  id: string;
  shortName: string;
}

async function main() {
  // Load seed data
  const seedPath = path.join(__dirname, 'seeds', 'practices.seed.json');
  const seeds: PracticeSeed[] = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));
  console.log(`Loaded ${seeds.length} practice seeds`);

  // Build a map from seed insurerId → shortName using prepagas.json
  const prepagasSeedPath = path.join(__dirname, 'seeds', 'prepagas.json');
  const prepagasSeed: PrepagaSeedEntry[] = JSON.parse(fs.readFileSync(prepagasSeedPath, 'utf-8'));
  const seedIdToShortName = new Map(prepagasSeed.map((p) => [p.id, p.shortName]));

  // Resolve seed insurerIds to live DB ids by shortName
  const uniqueShortNames = new Set<string>();
  for (const seed of seeds) {
    const shortName = seedIdToShortName.get(seed.insurerId);
    if (shortName) uniqueShortNames.add(shortName);
  }

  const dbPrepagas = (await app.service('prepagas').find({
    query: { $limit: 500 },
    paginate: false,
  } as any)) as any[];

  const shortNameToDbId = new Map<string, string>();
  for (const p of dbPrepagas) {
    shortNameToDbId.set(p.shortName.toUpperCase(), p.id);
  }

  // Build seed insurerId → DB insurerId map
  const seedIdToDbId = new Map<string, string>();
  let unmatchedInsurers = 0;
  for (const [seedId, shortName] of seedIdToShortName) {
    const dbId = shortNameToDbId.get(shortName.toUpperCase());
    if (dbId) {
      seedIdToDbId.set(seedId, dbId);
    }
  }

  for (const seed of seeds) {
    if (!seedIdToDbId.has(seed.insurerId)) {
      const shortName = seedIdToShortName.get(seed.insurerId) ?? seed.insurerId;
      if (!shortNameToDbId.has(shortName.toUpperCase())) {
        unmatchedInsurers++;
      }
    }
  }
  if (unmatchedInsurers > 0) {
    console.warn(`Warning: ${unmatchedInsurers} seed entries reference insurers not found in DB`);
  }

  // Resolve organizationId
  const orgs = (await app.service('organizations').find({
    query: { slug: ORG_SLUG },
    paginate: false,
  } as any)) as any[];

  if (orgs.length === 0) {
    throw new Error(`Organization with slug "${ORG_SLUG}" not found`);
  }
  const organizationId = orgs[0].id;
  console.log(`Organization: ${organizationId}`);

  // Fetch all practices for this org (triggers ensureSystemPractices)
  const practices = (await app.service('practices').find({
    query: { organizationId },
    organizationId,
    paginate: false,
  } as any)) as any[];

  // Build systemKey → practiceId map
  const systemKeyMap = new Map<string, string>();
  for (const p of practices) {
    if (p.systemKey) {
      systemKeyMap.set(p.systemKey, p.id);
    }
  }
  console.log(`Found ${systemKeyMap.size} system practices`);

  // Create non-system practices that don't exist yet
  const nonSystemKeys = new Set(
    seeds.filter((s) => !s.isSystem).map((s) => s.practiceKey)
  );

  for (const key of nonSystemKeys) {
    if (systemKeyMap.has(key)) continue;

    // Find the description from the first seed with this key
    const seed = seeds.find((s) => s.practiceKey === key);
    if (!seed) continue;

    // Use raw Sequelize model to bypass validatePractice hook
    const sequelize = app.get('sequelizeClient');
    const { practices: practicesModel } = sequelize.models;

    try {
      const created = await practicesModel.create({
        id: uuidv4(),
        organizationId,
        title: seed.description,
        description: seed.description,
        isSystem: false,
        systemKey: key,
      });

      systemKeyMap.set(key, created.id);
      console.log(`Created practice: ${seed.description} (${key}) → ${created.id}`);
    } catch (err: any) {
      if (err.name === 'SequelizeUniqueConstraintError') {
        // Already exists, find it
        const existing = await practicesModel.findOne({
          where: { organizationId, systemKey: key },
        });
        if (existing) systemKeyMap.set(key, existing.id);
      } else {
        throw err;
      }
    }
  }

  // Import practice codes
  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const seed of seeds) {
    const practiceId = systemKeyMap.get(seed.practiceKey);
    if (!practiceId) {
      console.error(`No practice found for key: ${seed.practiceKey}`);
      errors++;
      continue;
    }

    const dbInsurerId = seedIdToDbId.get(seed.insurerId);
    if (!dbInsurerId) {
      const shortName = seedIdToShortName.get(seed.insurerId) ?? seed.insurerId;
      console.error(`Insurer not in DB: ${shortName} (${seed.insurerId})`);
      errors++;
      continue;
    }

    try {
      await app.service('practice-codes').create({
        practiceId,
        userId: JUANCA_ID,
        insurerId: dbInsurerId,
        code: seed.code,
      } as any);
      created++;
    } catch (err: any) {
      if (err.name === 'SequelizeUniqueConstraintError') {
        skipped++;
      } else {
        console.error(`Error for ${seed.practiceKey} / ${seed.insurerId}: ${err.message}`);
        errors++;
      }
    }
  }

  console.log(`Done. Created: ${created}, Skipped (existing): ${skipped}, Errors: ${errors}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
