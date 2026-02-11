import { Sequelize, Model, ModelStatic, ModelOptions, ModelAttributes } from 'sequelize';
import { isObject } from 'lodash';
import { Application } from './declarations';

const isProduction = process.env.NODE_ENV === 'production';

interface CustomModel extends Model {
  decryptedAttributes?: any[];
}

interface CustomModelStatic extends ModelStatic<CustomModel> {
  decryptedAttributes?: any[];
}

interface EncryptedModelOptions extends ModelOptions {
  encryptedFields?: string[];
}

export default function (app: Application): void {
  const oldSetup = app.setup;
  const connectionString = app.get('postgres');
  const dbName = connectionString.split('/').pop();
  const sequelize = new Sequelize(connectionString, {
    dialect: 'postgres',
    logging: false,
    define: {
      freezeTableName: true
    }
  });

  if (!isProduction) {
    const defaultConnection = new Sequelize(
      connectionString.replace(/\/[^/]+$/, '/postgres'),
      {
        dialect: 'postgres',
        logging: false
      }
    );

    defaultConnection.query(`CREATE DATABASE ${dbName}`)
      .then(() => {
        console.log(`Database ${dbName} created.`);
      })
      .catch((error: any) => {
        if (error.parent?.code !== '42P04') {
          throw error;
        }
      })
      .finally(() => {
        defaultConnection.close();
      });
  }

  app.set('sequelizeClient', sequelize);
  (app as any).setup = function (server?: any): Application {
    const result = (oldSetup as any).call(this, server) as Application;
    const models = sequelize.models;

    Object.keys(models).forEach(name => {
      if ('associate' in models[name]) {
        (models[name] as any).associate(models);
      }
    });

    const syncWithSearchColumns = async () => {
      // Drop generated columns before sync to avoid conflicts with alter
      try {
        await sequelize.query('ALTER TABLE "personal_data" DROP COLUMN IF EXISTS "searchFirstName"');
        await sequelize.query('ALTER TABLE "personal_data" DROP COLUMN IF EXISTS "searchLastName"');
      } catch (e) { // eslint-disable-line @typescript-eslint/no-unused-vars
        // Table might not exist yet on first run, that's fine
      }

      await sequelize.sync({ alter: !isProduction });

      // Re-add generated columns after sync
      try {
        await sequelize.query('CREATE EXTENSION IF NOT EXISTS unaccent');
        await sequelize.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
        await sequelize.query(`
          CREATE OR REPLACE FUNCTION immutable_unaccent(text)
          RETURNS text AS $$
          BEGIN
            RETURN unaccent($1);
          END;
          $$ LANGUAGE plpgsql IMMUTABLE;
        `);
        await sequelize.query(`
          ALTER TABLE "personal_data"
          ADD COLUMN "searchFirstName" text
          GENERATED ALWAYS AS (immutable_unaccent(lower("firstName"))) STORED;

          ALTER TABLE "personal_data"
          ADD COLUMN "searchLastName" text
          GENERATED ALWAYS AS (immutable_unaccent(lower("lastName"))) STORED;

          ALTER TABLE "medications" DROP COLUMN IF EXISTS "searchText";
          ALTER TABLE "medications"
          ADD COLUMN "searchText" text
          GENERATED ALWAYS AS (immutable_unaccent(lower("commercialNamePresentation" || ' ' || "genericDrug"))) STORED;

          CREATE INDEX IF NOT EXISTS personal_data_search_first_name_idx ON "personal_data" USING gin ("searchFirstName" gin_trgm_ops);
          CREATE INDEX IF NOT EXISTS personal_data_search_last_name_idx ON "personal_data" USING gin ("searchLastName" gin_trgm_ops);
          CREATE INDEX IF NOT EXISTS medications_search_text_idx ON "medications" USING gin ("searchText" gin_trgm_ops);
        `);
      } catch (e: any) {
        console.error('Error creating generated columns or indexes:', e?.message || e);
      }
    };

    app.set('sequelizeSync', syncWithSearchColumns());

    return result;
  };
}

export const makeDefine = (sequelize: Sequelize) => (
  modelName: string,
  attributes: ModelAttributes,
  options: EncryptedModelOptions = {}
) => {
  const { encryptedFields = [], ...modelOptions } = options;
  const encryptionKey = process.env.ENCRYPTION_KEY;

  if (!encryptionKey) {
    throw new Error('ENCRYPTION_KEY is not defined in environment variables');
  }

  const Model = sequelize.define(
    modelName,
    attributes,
    modelOptions
  ) as unknown as CustomModelStatic;

  const encryptAttributes = async (record: any) => {
    const { fn } = sequelize;
    const PG_ENCRYPT_FN = 'PGP_SYM_ENCRYPT';

    const handleValue = (value: any) => {
      if (isObject(value)) {
        return JSON.stringify(value).replace(/\$/g, '\\$');
      }

      return typeof value === 'string' ? value.replace(/\$/g, '\\$') : value;
    };

    const encryptField = (value: any) =>
      fn(PG_ENCRYPT_FN, value, encryptionKey);

    encryptedFields.forEach((field: string) => {
      const isBulkUpdate = record.type === 'BULKUPDATE';

      if (isBulkUpdate && record.attributes[field]) {
        record.attributes[field] = encryptField(handleValue(record.attributes[field]));
      }

      if (record[field]) {
        record[field] = encryptField(handleValue(record[field]));
      }
    });

    return record;
  };

  if (encryptedFields.length > 0) {
    Model.decryptedAttributes = [
      ...Object.keys(Model.getAttributes()).filter(
        (field) => !encryptedFields.includes(field)
      ),
      ...encryptedFields.map((field: string) => [
        sequelize.fn(
          'PGP_SYM_DECRYPT',
          sequelize.cast(sequelize.col(field), 'bytea'),
          encryptionKey
        ),
        field,
      ]),
    ];

    Model.beforeCreate(encryptAttributes);
    Model.beforeUpdate(encryptAttributes);
    Model.beforeBulkUpdate(encryptAttributes);
  }

  return Model;
};
