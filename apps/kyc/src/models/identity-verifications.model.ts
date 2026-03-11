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
    },
    sessionId: {
      type: DataTypes.STRING,
      allowNull: true,
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
    },
    // Automated check results
    dniScanData: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    dniScanMatch: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    dniScanErrors: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    faceMatchConfidence: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    faceMatch: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    faceMatchError: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    selfieExifDate: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    selfieRecent: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    autoCheckCompletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    autoCheckProgress: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    // Forensic / audit fields
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
    personalData: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
  }, {
    hooks: {
      beforeCount(options: any): HookReturn {
        options.raw = true;
      },
    },
    indexes: [
      { fields: ['userId'] },
      { fields: ['sessionId'] },
      { fields: ['status'] },
      { fields: ['createdAt'] },
    ],
  });

  (identityVerifications as any).associate = function (models: any): void {
    const { verification_sessions } = models;
    if (verification_sessions) {
      identityVerifications.belongsTo(verification_sessions, {
        foreignKey: 'sessionId',
        as: 'session',
      });
    }
  };

  return identityVerifications;
}
