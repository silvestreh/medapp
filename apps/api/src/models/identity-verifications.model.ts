import { Sequelize, DataTypes, Model } from 'sequelize';
import { Application } from '../declarations';
import { HookReturn } from 'sequelize/types/hooks';

export default function (app: Application): typeof Model {
  const sequelizeClient: Sequelize = app.get('sequelizeClient');
  const identityVerifications = sequelizeClient.define('identity_verifications', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    userId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    status: {
      type: DataTypes.ENUM('pending', 'verified', 'rejected'),
      allowNull: false,
      defaultValue: 'pending',
    },
    idFrontUrl: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    idBackUrl: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    selfieUrl: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    rejectionReason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    verifiedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    verifiedBy: {
      type: DataTypes.STRING,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
    },
  }, {
    hooks: {
      beforeCount(options: any): HookReturn {
        options.raw = true;
      },
    },
    indexes: [
      { fields: ['userId'] },
      { fields: ['status'] },
      { fields: ['createdAt'] },
    ],
  });

  (identityVerifications as any).associate = function (models: any): void {
    const { users } = models;
    identityVerifications.belongsTo(users, { foreignKey: 'userId', as: 'user' });
    identityVerifications.belongsTo(users, { foreignKey: 'verifiedBy', as: 'reviewer' });
  };

  return identityVerifications;
}
