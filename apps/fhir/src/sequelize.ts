import { Sequelize, DataTypes, ModelAttributes, ModelOptions, Model, ModelStatic } from 'sequelize';

interface EncryptedModelOptions extends ModelOptions {
  encryptedFields?: string[];
}

interface DecryptableModel extends ModelStatic<Model> {
  decryptedAttributes?: unknown[];
}

export function createSequelize(): Sequelize {
  const connectionString = process.env.DB_URL;
  if (!connectionString) {
    throw new Error('DB_URL environment variable is required');
  }

  return new Sequelize(connectionString, {
    dialect: 'postgres',
    logging: false,
    define: {
      freezeTableName: true,
    },
    ...(process.env.DB_SSL === 'true' && {
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
        },
      },
    }),
  });
}

export function makeDefine(sequelize: Sequelize) {
  return function (
    modelName: string,
    attributes: ModelAttributes,
    options: EncryptedModelOptions = {}
  ): DecryptableModel {
    const { encryptedFields = [], ...modelOptions } = options;
    const encryptionKey = process.env.ENCRYPTION_KEY;

    if (!encryptionKey) {
      throw new Error('ENCRYPTION_KEY is not defined in environment variables');
    }

    const DefinedModel = sequelize.define(modelName, attributes, modelOptions) as DecryptableModel;

    if (encryptedFields.length > 0) {
      DefinedModel.decryptedAttributes = [
        ...Object.keys(DefinedModel.getAttributes()).filter(
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
    }

    return DefinedModel;
  };
}
