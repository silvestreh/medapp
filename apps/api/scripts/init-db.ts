import app from '../src/app';
import { Sequelize } from 'sequelize';
import roles from './seeds/roles.json';
import cie10 from './seeds/cie-10.json';

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

    // Enable unaccent extension for search
    await sequelize.query('CREATE EXTENSION IF NOT EXISTS unaccent');

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

    // Seed ICD-10
    console.log('Seeding ICD-10 data...');
    const icd10Service = app.service('icd-10');
    const nodesByCode = new Map<string, any>();

    // First pass: create all nodes and map them
    for (const item of cie10) {
      const node = {
        id: item.code,
        name: item.description,
        parent: null,
        children: [] as string[],
        level: item.level
      };
      nodesByCode.set(node.id, node);
    }

    // Second pass: establish parent-child relationships
    // The cie-10.json has level and sometimes code_0, code_1 etc.
    // We can use the level and the order to find parents if code_0 is missing,
    // but the file seems to have code_0 for level 1.
    const lastNodeAtLevel = new Map<number, string>();

    for (const item of cie10) {
      const node = nodesByCode.get(item.code);
      const level = item.level;

      if (level > 0) {
        let parentCode = (item as any).code_0 || (item as any).code_1 || (item as any).code_2;

        if (!parentCode) {
          // Fallback to the last node seen at level - 1
          parentCode = lastNodeAtLevel.get(level - 1);
        }

        if (parentCode && nodesByCode.has(parentCode)) {
          node.parent = parentCode;
          nodesByCode.get(parentCode).children.push(node.id);
        }
      }
      lastNodeAtLevel.set(level, node.id);
    }

    // Convert map to array for bulk insert
    const finalData = Array.from(nodesByCode.values()).map(({ ...rest }) => rest);

    // Bulk create in chunks to avoid memory/query limits
    const chunkSize = 500;
    for (let i = 0; i < finalData.length; i += chunkSize) {
      const chunk = finalData.slice(i, i + chunkSize);
      await icd10Service.create(chunk);
      if (i % 1000 === 0) console.log(`Seeded ${i} / ${finalData.length} ICD-10 entries`);
    }

    console.log('Database initialization completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  }
}

initDatabase();
