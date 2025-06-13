import app from '../src/app';
import { Sequelize } from 'sequelize';

async function waitForDrop(dbName: string, defaultConnection: Sequelize, maxAttempts = 10): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const [results] = await defaultConnection.query(
        'SELECT 1 FROM pg_database WHERE datname = :dbName',
        {
          replacements: { dbName },
          type: 'SELECT'
        }
      );
      if (!results) return;
      if (attempt === maxAttempts) throw new Error('Database still exists after maximum attempts');
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error: any) {
      if (error.parent?.code === '3D000') return; // Database doesn't exist
      throw error;
    }
  }
}

async function dropDatabase() {
  try {
    const connectionString = app.get('postgres');
    const dbName = connectionString.split('/').pop();

    const defaultConnection = new Sequelize(
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

    // Wait for the database to be fully dropped
    await waitForDrop(dbName, defaultConnection);

    console.log(`Database ${dbName} dropped successfully.`);

    await defaultConnection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error dropping database:', error);
    process.exit(1);
  }
}

dropDatabase();
