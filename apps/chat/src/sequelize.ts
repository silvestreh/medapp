import { Sequelize } from 'sequelize';
import { Application } from './declarations';

const isProduction = process.env.NODE_ENV === 'production';

export default function (app: Application): void {
  const connectionString = app.get('postgres');
  const sequelize = new Sequelize(connectionString, {
    dialect: 'postgres',
    logging: false,
    define: { freezeTableName: true },
    ...(isProduction && {
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
        },
      },
    }),
  });

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

    app.set('sequelizeSync', sequelize.sync({ alter: !isProduction }));

    return result;
  };
}
