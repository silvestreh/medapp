import { Sequelize, Model, ModelStatic, ModelOptions, ModelAttributes } from 'sequelize';
import { isObject } from './utils';

interface CustomModel extends Model {
  decryptedAttributes?: any[];
}

interface CustomModelStatic extends ModelStatic<CustomModel> {
  decryptedAttributes?: any[];
}

interface EncryptedModelOptions extends ModelOptions {
  encryptedFields?: string[];
}

/**
 * Creates a Sequelize model definition function that supports PGP_SYM_ENCRYPT/DECRYPT.
 * Each service passes its own encryption key.
 *
 * Usage:
 *   const define = makeDefine(sequelize, process.env.MY_SERVICE_ENCRYPTION_KEY);
 *   const MyModel = define('my_model', { ... }, { encryptedFields: ['ssn'] });
 */
export const makeDefine = (sequelize: Sequelize, encryptionKey?: string) =>
  (modelName: string, attributes: ModelAttributes, options: EncryptedModelOptions = {}): CustomModelStatic => {
    const { encryptedFields = [], ...modelOptions } = options;

    if (encryptedFields.length > 0 && !encryptionKey) {
      throw new Error(`ENCRYPTION_KEY is required for model "${modelName}" with encrypted fields`);
    }

    const DefinedModel = sequelize.define(modelName, attributes, modelOptions) as unknown as CustomModelStatic;

    const encryptAttributes = async (record: any) => {
      const { fn } = sequelize;
      const PG_ENCRYPT_FN = 'PGP_SYM_ENCRYPT';

      const handleValue = (value: any) => {
        if (isObject(value)) {
          return JSON.stringify(value).replace(/\$/g, '\\$');
        }
        return typeof value === 'string' ? value.replace(/\$/g, '\\$') : value;
      };

      const encryptField = (value: any) => fn(PG_ENCRYPT_FN, value, encryptionKey!);

      encryptedFields.forEach((field) => {
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
      DefinedModel.decryptedAttributes = [
        ...Object.keys(DefinedModel.getAttributes()).filter(
          (field) => !encryptedFields.includes(field)
        ),
        ...encryptedFields.map((field) => [
          sequelize.fn('PGP_SYM_DECRYPT', sequelize.cast(sequelize.col(field), 'bytea'), encryptionKey!),
          field,
        ]),
      ];

      DefinedModel.beforeCreate(encryptAttributes);
      DefinedModel.beforeUpdate(encryptAttributes);
      DefinedModel.beforeBulkUpdate(encryptAttributes);
    }

    return DefinedModel;
  };
