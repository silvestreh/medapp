import { Sequelize, DataTypes, Model } from 'sequelize';
import { Application } from '../declarations';
import { makeDefine } from '../sequelize';
import { HookReturn } from 'sequelize/types/hooks';

export default function (app: Application): typeof Model {
  const sequelizeClient: Sequelize = app.get('sequelizeClient');
  const define = makeDefine(sequelizeClient);
  const signingCertificates = define('signing_certificates', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    userId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    certificate: {
      type: DataTypes.BLOB,
      allowNull: false,
    },
    fileName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    isClientEncrypted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  }, {
    encryptedFields: ['certificate'],
    hooks: {
      beforeCount(options: any): HookReturn {
        options.raw = true;
      },
    },
  });

  (signingCertificates as any).associate = function (models: any): void {
    const { users } = models;
    signingCertificates.belongsTo(users, { foreignKey: 'userId' });
  };

  return signingCertificates;
}
