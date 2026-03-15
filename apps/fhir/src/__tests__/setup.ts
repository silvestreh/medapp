import jwt from 'jsonwebtoken';
import { Sequelize } from 'sequelize';
import { createApp } from '../app';
import { defineModels, Models } from '../models';

const TEST_JWT_SECRET = 'test-fhir-jwt-secret';
const TEST_ENCRYPTION_KEY = 'test-encryption-key-32chars!!!!!';
const TEST_POSTGRES_URI = 'postgres://postgres:@localhost:5432/athelas_api_test';

// Set env vars before anything else
process.env.FHIR_JWT_SECRET = TEST_JWT_SECRET;
process.env.ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;
process.env.DB_URL = TEST_POSTGRES_URI;

let sequelize: Sequelize;
let models: Models;
let app: ReturnType<typeof createApp>;

export function getApp() {
  return app;
}

export function getModels() {
  return models;
}

export function getSequelize() {
  return sequelize;
}

export function generateTestToken(payload: Record<string, unknown> = {}): string {
  return jwt.sign(
    {
      sub: 'test-bus-client',
      iss: 'dnsis-test',
      name: 'Test Client',
      ...payload,
    },
    TEST_JWT_SECRET,
    { expiresIn: '15m' }
  );
}

export async function setupTestApp(): Promise<void> {
  sequelize = new Sequelize(TEST_POSTGRES_URI, {
    dialect: 'postgres',
    logging: false,
    define: { freezeTableName: true },
  });

  await sequelize.authenticate();
  models = defineModels(sequelize);
  app = createApp(models);
}

export async function teardownTestApp(): Promise<void> {
  if (sequelize) {
    await sequelize.close();
  }
}
