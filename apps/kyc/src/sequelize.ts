import { Sequelize } from 'sequelize';
import { Application } from './declarations';

const isProduction = process.env.NODE_ENV === 'production';

export default function (app: Application): void {
  const connectionString = app.get('postgres');
  const dbName = connectionString.split('/').pop();
  const sequelize = new Sequelize(connectionString, {
    dialect: 'postgres',
    logging: false,
    define: { freezeTableName: true },
    ...(process.env.DB_SSL === 'true' && {
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
        },
      },
    }),
  });

  const ensureDatabase = isProduction
    ? Promise.resolve()
    : (async () => {
        const defaultConnection = new Sequelize(
          connectionString.replace(/\/[^/]+$/, '/postgres'),
          { dialect: 'postgres', logging: false }
        );
        try {
          await defaultConnection.query(`CREATE DATABASE ${dbName}`);
        } catch (error: any) {
          if (error.parent?.code !== '42P04') {
            throw error;
          }
        } finally {
          await defaultConnection.close();
        }
      })();

  const oldSetup = app.setup;

  app.set('sequelizeClient', sequelize);

  (app as any).setup = function (server?: any): Application {
    const result = (oldSetup as any).call(this, server) as Application;

    const models = sequelize.models;
    Object.keys(models).forEach((name) => {
      if ('associate' in models[name]) {
        (models[name] as any).associate(models);
      }
    });

    app.set(
      'sequelizeSync',
      ensureDatabase
        .then(() => sequelize.sync({ alter: !isProduction }))
        .then(() => console.log('[sequelize] sync complete'))
        .catch((err: any) => {
          console.error('[sequelize] sync FAILED:', err.message);
          process.exit(1);
        })
    );

    return result;
  };
}
