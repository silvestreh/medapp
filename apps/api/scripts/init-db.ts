import app from '../src/app';
import { Sequelize } from 'sequelize';
import roles from './seeds/roles.json';

async function waitForConnection(sequelize: Sequelize, maxAttempts = 10): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await sequelize.authenticate();
      return;
    } catch (error) {
      if (attempt === maxAttempts) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

async function initDatabase() {
  try {
    const connectionString = app.get('postgres');

    // Connect to default postgres database
    const defaultConnection = new Sequelize(
      connectionString.replace(/\/[^/]+$/, '/postgres'),
      {
        dialect: 'postgres',
        logging: false
      }
    );

    // Extract database name from connection string
    const dbName = connectionString.split('/').pop();

    // Create database if it doesn't exist
    try {
      await defaultConnection.query(`CREATE DATABASE ${dbName}`);
      console.log(`Database ${dbName} created successfully.`);
    } catch (error: any) {
      if (error.parent?.code === '42P04') { // Database already exists
        console.log(`Database ${dbName} already exists.`);
      } else {
        throw error;
      }
    }

    await defaultConnection.close();

    // Connect to our app database
    const sequelize = app.get('sequelizeClient');

    // Wait for the database to be ready
    await waitForConnection(sequelize);

    // Sync all models
    await sequelize.sync({ force: true });
    console.log('All tables created successfully.');

    // Seed roles if needed
    const rolesService = app.service('roles');

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

    console.log('Database initialization completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  }
}

initDatabase();
