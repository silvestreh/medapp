import app from '../src/app';
import { Sequelize } from 'sequelize';
import roles from './seeds/roles.json';

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function resetDatabase() {
  let defaultConnection: Sequelize | null = null;

  try {
    const connectionString = app.get('postgres');
    const dbName = connectionString.split('/').pop();

    // Connect to default postgres database
    defaultConnection = new Sequelize(
      connectionString.replace(/\/[^/]+$/, '/postgres'),
      {
        dialect: 'postgres',
        logging: false
      }
    );

    console.log(`Attempting to drop database ${dbName}...`);

    // Force disconnect all users
    await defaultConnection.query(`
      SELECT pg_terminate_backend(pg_stat_activity.pid)
      FROM pg_stat_activity
      WHERE pg_stat_activity.datname = '${dbName}'
      AND pid <> pg_backend_pid();
    `);

    // Drop the database
    await defaultConnection.query(`DROP DATABASE IF EXISTS ${dbName}`);
    console.log(`Database ${dbName} dropped successfully.`);

    // Wait a moment before creating the new database
    await sleep(1000);

    // Create the database
    await defaultConnection.query(`CREATE DATABASE ${dbName}`);
    console.log(`Database ${dbName} created successfully.`);
    await sleep(1000);

    // Close default connection
    await defaultConnection.close();
    defaultConnection = null;

    // Connect to our app database and create extension
    const sequelize = app.get('sequelizeClient');
    await sequelize.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');
    console.log('pgcrypto extension created successfully.');

    await sequelize.query('CREATE EXTENSION IF NOT EXISTS unaccent;');
    console.log('unaccent extension created successfully.');

    // Create an immutable wrapper for unaccent because generated columns 
    // require immutable functions, and unaccent is not immutable by default.
    await sequelize.query(`
      CREATE OR REPLACE FUNCTION immutable_unaccent(text)
      RETURNS text AS $$
      BEGIN
        RETURN unaccent($1);
      END;
      $$ LANGUAGE plpgsql IMMUTABLE;
    `);
    console.log('immutable_unaccent function created successfully.');

    await sequelize.query('CREATE EXTENSION IF NOT EXISTS pg_trgm;');
    console.log('pg_trgm extension created successfully.');

    // Sync models
    await sequelize.sync({ force: true });
    console.log('All tables created successfully.');

    // Add generated columns for search
    await sequelize.query(`
      ALTER TABLE "personal_data" DROP COLUMN IF EXISTS "searchFirstName";
      ALTER TABLE "personal_data" DROP COLUMN IF EXISTS "searchLastName";

      ALTER TABLE "personal_data" 
      ADD COLUMN "searchFirstName" text 
      GENERATED ALWAYS AS (immutable_unaccent(lower("firstName"))) STORED;
      
      ALTER TABLE "personal_data" 
      ADD COLUMN "searchLastName" text 
      GENERATED ALWAYS AS (immutable_unaccent(lower("lastName"))) STORED;

      CREATE INDEX IF NOT EXISTS personal_data_search_first_name_idx ON "personal_data" USING gin ("searchFirstName" gin_trgm_ops);
      CREATE INDEX IF NOT EXISTS personal_data_search_last_name_idx ON "personal_data" USING gin ("searchLastName" gin_trgm_ops);
    `);

    // Seed roles
    const rolesService = app.service('roles');

    if (require.main === module) {
      for (const role of roles) {
        try {
          await rolesService.create(role);
          console.log(`Created role: ${role.id}`);
        } catch (error: any) {
          if (error.name === 'Conflict') {
            console.log(`Role ${role.id} already exists`);
          } else {
            throw error;
          }
        }
      }
    }

    console.log('Database reset completed successfully.');
  } catch (error) {
    console.error('Error resetting database:', error);
    process.exit(1);
  } finally {
    if (defaultConnection) {
      await defaultConnection.close().catch(console.error);
    }
  }
}

if (require.main === module) {
  resetDatabase()
    .then(() => {
      // Process will exit from within resetDatabase
      process.exit(0);
    })
    .catch((error) => {
      console.error('Failed to reset database:', error);
      process.exit(1);
    });
}
