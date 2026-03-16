import { Sequelize, DataTypes, Model } from 'sequelize';
import { Application } from '../declarations';

export default function (app: Application): typeof Model {
  const sequelizeClient: Sequelize = app.get('sequelizeClient');
  const accessLogs = sequelizeClient.define('access_logs', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    userId: {
      type: DataTypes.STRING,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    organizationId: {
      type: DataTypes.STRING,
      allowNull: true,
      references: {
        model: 'organizations',
        key: 'id'
      }
    },
    resource: {
      type: DataTypes.ENUM('encounters', 'studies', 'prescriptions', 'shared-access', 'authentication', 'access-control', 'configuration', 'system', 'user-management'),
      allowNull: false,
    },
    patientId: {
      type: DataTypes.STRING,
      allowNull: true,
      references: {
        model: 'patients',
        key: 'id'
      }
    },
    action: {
      type: DataTypes.ENUM('read', 'write', 'export', 'grant', 'login', 'logout', 'deny', 'execute'),
      allowNull: false,
    },
    purpose: {
      type: DataTypes.ENUM('treatment', 'billing', 'emergency', 'operations', 'share'),
      allowNull: false,
      defaultValue: 'treatment',
    },
    refesId: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Government identifier for the organization (from organizations.settings.refesId)'
    },
    hash: {
      type: DataTypes.STRING(64),
      allowNull: true,
      comment: 'SHA-256 hash for tamper-evident chain'
    },
    previousLogId: {
      type: DataTypes.STRING,
      allowNull: true,
      references: {
        model: 'access_logs',
        key: 'id'
      },
      comment: 'Previous log entry in the per-organization hash chain'
    },
    ip: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Extra context, e.g. { onBehalfOfMedicId: "..." } for delegated prescriptions'
    }
  }, {
    updatedAt: false,
    indexes: [
      { fields: ['userId'] },
      { fields: ['resource'] },
      { fields: ['patientId'] },
      { fields: ['createdAt'] },
      { fields: ['organizationId', 'createdAt'] },
      { fields: ['purpose'] },
    ]
  });

  (accessLogs as any).associate = function (models: any): void {
    const { users, organizations, patients } = models;
    accessLogs.belongsTo(users, { foreignKey: 'userId' });
    accessLogs.belongsTo(organizations, { foreignKey: 'organizationId' });
    accessLogs.belongsTo(patients, { foreignKey: 'patientId' });
  };

  return accessLogs;
}
