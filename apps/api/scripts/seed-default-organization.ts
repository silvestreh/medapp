/**
 * One-time migration script: creates a default organization and links
 * all existing users, patients, and records to it.
 *
 * Usage:
 *   npx ts-node scripts/seed-default-organization.ts
 *
 * This script is idempotent — it checks for existing data before inserting.
 */
import dotenv from 'dotenv';
dotenv.config();

import { Sequelize, QueryTypes } from 'sequelize';
import { randomUUID as uuid } from 'crypto';

const connectionString = process.env.POSTGRES || 'postgres://localhost:5432/athelas';

async function main() {
  const sequelize = new Sequelize(connectionString, {
    dialect: 'postgres',
    logging: false
  });

  const DEFAULT_ORG_SLUG = 'default';
  const DEFAULT_ORG_NAME = 'Default Organization';

  console.log('Checking for existing default organization...');
  const existing = await sequelize.query<{ id: string }>(
    'SELECT id FROM organizations WHERE slug = :slug LIMIT 1',
    { replacements: { slug: DEFAULT_ORG_SLUG }, type: QueryTypes.SELECT }
  );

  let orgId: string;

  if (existing.length > 0) {
    orgId = existing[0].id;
    console.log(`Default organization already exists: ${orgId}`);
  } else {
    orgId = uuid();
    await sequelize.query(
      `INSERT INTO organizations (id, name, slug, settings, "createdAt", "updatedAt")
       VALUES (:id, :name, :slug, :settings, NOW(), NOW())`,
      {
        replacements: {
          id: orgId,
          name: DEFAULT_ORG_NAME,
          slug: DEFAULT_ORG_SLUG,
          settings: '{}'
        },
        type: QueryTypes.INSERT
      }
    );
    console.log(`Created default organization: ${orgId}`);
  }

  console.log('Linking users to default organization...');
  const users = await sequelize.query<{ id: string }>(
    'SELECT id FROM users WHERE id NOT IN (SELECT "userId" FROM organization_users WHERE "organizationId" = :orgId)',
    { replacements: { orgId }, type: QueryTypes.SELECT }
  );

  for (const user of users) {
    await sequelize.query(
      `INSERT INTO organization_users (id, "organizationId", "userId", role, "createdAt", "updatedAt")
       VALUES (:id, :orgId, :userId, 'owner', NOW(), NOW())`,
      { replacements: { id: uuid(), orgId, userId: user.id }, type: QueryTypes.INSERT }
    );
  }
  console.log(`Linked ${users.length} users.`);

  console.log('Linking patients to default organization...');
  const patients = await sequelize.query<{ id: string }>(
    'SELECT id FROM patients WHERE id NOT IN (SELECT "patientId" FROM organization_patients WHERE "organizationId" = :orgId)',
    { replacements: { orgId }, type: QueryTypes.SELECT }
  );

  for (const patient of patients) {
    await sequelize.query(
      `INSERT INTO organization_patients (id, "organizationId", "patientId", "createdAt", "updatedAt")
       VALUES (:id, :orgId, :patientId, NOW(), NOW())`,
      { replacements: { id: uuid(), orgId, patientId: patient.id }, type: QueryTypes.INSERT }
    );
  }
  console.log(`Linked ${patients.length} patients.`);

  console.log('Updating encounters...');
  const [, encounterCount] = await sequelize.query(
    'UPDATE encounters SET "organizationId" = :orgId WHERE "organizationId" IS NULL',
    { replacements: { orgId } }
  );
  console.log(`Updated ${(encounterCount as any)?.rowCount ?? 0} encounters.`);

  console.log('Updating appointments...');
  const [, appointmentCount] = await sequelize.query(
    'UPDATE appointments SET "organizationId" = :orgId WHERE "organizationId" IS NULL',
    { replacements: { orgId } }
  );
  console.log(`Updated ${(appointmentCount as any)?.rowCount ?? 0} appointments.`);

  console.log('Updating studies...');
  const [, studyCount] = await sequelize.query(
    'UPDATE studies SET "organizationId" = :orgId WHERE "organizationId" IS NULL',
    { replacements: { orgId } }
  );
  console.log(`Updated ${(studyCount as any)?.rowCount ?? 0} studies.`);

  console.log('Updating time_off_events...');
  const [, timeOffCount] = await sequelize.query(
    'UPDATE time_off_events SET "organizationId" = :orgId WHERE "organizationId" IS NULL',
    { replacements: { orgId } }
  );
  console.log(`Updated ${(timeOffCount as any)?.rowCount ?? 0} time off events.`);

  console.log('Updating md_settings...');
  const [, mdCount] = await sequelize.query(
    'UPDATE md_settings SET "organizationId" = :orgId WHERE "organizationId" IS NULL',
    { replacements: { orgId } }
  );
  console.log(`Updated ${(mdCount as any)?.rowCount ?? 0} md_settings.`);

  console.log('Done! Default organization seeded successfully.');
  await sequelize.close();
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
