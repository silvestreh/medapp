import { Sequelize, DataTypes, Model } from 'sequelize';
import { Application } from '../declarations';
import { HookReturn } from 'sequelize/types/hooks';

export default function (app: Application): typeof Model {
  const sequelizeClient: Sequelize = app.get('sequelizeClient');
  const verification_sessions = sequelizeClient.define('verification_sessions', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    userId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    token: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    status: {
      type: DataTypes.ENUM('waiting', 'uploading', 'completed', 'expired'),
      defaultValue: 'waiting',
      allowNull: false,
    },
    idFrontUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    idBackUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    selfieUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    clientIp: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    clientUserAgent: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    deviceFingerprint: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    idData: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    callbackUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    callbackSecret: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    documentType: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  }, {
    indexes: [
      { fields: ['token'], unique: true },
      { fields: ['userId'] },
      { fields: ['status'] },
    ],
    hooks: {
      beforeCount(options: any): HookReturn {
        options.raw = true;
      },
    },
  });

  (verification_sessions as any).associate = function (_models: any): void {};

  return verification_sessions;
}
