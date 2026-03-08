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
      allowNull: false,
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
      type: DataTypes.ENUM('encounters', 'studies', 'prescriptions'),
      allowNull: false,
    },
    patientId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'patients',
        key: 'id'
      }
    },
    action: {
      type: DataTypes.ENUM('read', 'write', 'export'),
      allowNull: false,
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
