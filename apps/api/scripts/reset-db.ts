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

    // Sync models
    await sequelize.sync({ force: true });
    console.log('All tables created successfully.');

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
