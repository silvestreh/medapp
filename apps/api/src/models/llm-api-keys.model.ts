import { Sequelize, DataTypes, Model } from 'sequelize';
import { Application } from '../declarations';
import { makeDefine } from '../sequelize';
import { HookReturn } from 'sequelize/types/hooks';

export default function (app: Application): typeof Model {
  const sequelizeClient: Sequelize = app.get('sequelizeClient');
  const define = makeDefine(sequelizeClient);
  const llmApiKeys = define('llm_api_keys', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    provider: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    key: {
      type: DataTypes.BLOB,
      allowNull: false,
    },
    keyHint: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    organizationId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'organizations',
        key: 'id',
      },
    },
  }, {
    encryptedFields: ['key'],
    hooks: {
      beforeCount(options: any): HookReturn {
        options.raw = true;
      },
    },
    indexes: [
      {
        unique: true,
        fields: ['organizationId', 'provider'],
      },
    ],
  });

  (llmApiKeys as any).associate = function (models: any): void {
    const { organizations } = models;
    llmApiKeys.belongsTo(organizations, { foreignKey: 'organizationId' });
  };

  return llmApiKeys;
}
