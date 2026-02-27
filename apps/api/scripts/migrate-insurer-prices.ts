import app from '../src/app';
import { Sequelize } from 'sequelize';

async function migrateInsurerPrices() {
  try {
    const sequelize: Sequelize = app.get('sequelizeClient');
    await app.get('sequelizeSync');

    const hasInsurerPrices = await sequelize.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'md_settings' AND column_name = 'insurerPrices'
    `).then(([rows]) => rows.length > 0);

    if (!hasInsurerPrices) {
      console.log('Column "insurerPrices" not found in md_settings. Nothing to migrate.');
      process.exit(0);
    }

    const rows = await sequelize.query(
      `SELECT id, "organizationId", "userId", "insurerPrices" FROM md_settings WHERE "insurerPrices" IS NOT NULL AND "insurerPrices" != '{}'::jsonb`,
      { type: 'SELECT' as any }
    ) as { id: string; organizationId: string | null; userId: string; insurerPrices: Record<string, unknown> }[];

    console.log(`Found ${rows.length} md_settings rows with insurerPrices data.`);

    let created = 0;
    let skipped = 0;

    for (const row of rows) {
      const existing = await app.service('accounting-settings').find({
        query: { userId: row.userId, $limit: 1 },
        paginate: false,
      }) as any[];

      if (existing.length > 0) {
        console.log(`  Skipping userId=${row.userId} (accounting-settings record already exists)`);
        skipped++;
        continue;
      }

      await app.service('accounting-settings').create({
        organizationId: row.organizationId,
        userId: row.userId,
        insurerPrices: row.insurerPrices,
      } as any);

      created++;
    }

    console.log(`\nMigration complete: ${created} created, ${skipped} skipped.`);
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrateInsurerPrices();
