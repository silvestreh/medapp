import dotenv from 'dotenv';
dotenv.config();

import { createSequelize } from './sequelize';
import { defineModels } from './models';
import { createApp } from './app';

const PORT = parseInt(process.env.FHIR_PORT || '3040', 10);

async function main() {
  const sequelize = createSequelize();

  // Verify DB connection
  await sequelize.authenticate();
  console.log('Database connection established.');

  const models = defineModels(sequelize);
  const app = createApp(models);

  app.listen(PORT, () => {
    console.log(`FHIR Wrapper API listening on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error('Failed to start FHIR server:', err);
  process.exit(1);
});
