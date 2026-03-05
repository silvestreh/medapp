import { Sequelize, DataTypes, Model } from 'sequelize';
import { Application } from '../declarations';
import { HookReturn } from 'sequelize/types/hooks';

export default function (app: Application): typeof Model {
  const sequelizeClient: Sequelize = app.get('sequelizeClient');
  const prescriptions = sequelizeClient.define('prescriptions', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    organizationId: {
      type: DataTypes.STRING,
      allowNull: true,
      references: {
        model: 'organizations',
        key: 'id',
      },
    },
    medicId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    patientId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'patients',
        key: 'id',
      },
    },
    recetarioReference: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    recetarioDocumentIds: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
    },
    type: {
      type: DataTypes.ENUM('prescription', 'order'),
      allowNull: false,
      defaultValue: 'prescription',
    },
    quickLinkUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    quickLinkExpiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('pending', 'completed', 'cancelled', 'expired'),
      allowNull: false,
      defaultValue: 'pending',
    },
    sharedVia: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    sharedTo: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    content: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
  }, {
    hooks: {
      beforeCount(options: any): HookReturn {
        options.raw = true;
      },
    },
  });

  (prescriptions as any).associate = function (models: any): void {
    const { users, patients, organizations } = models;
    prescriptions.belongsTo(organizations, { foreignKey: 'organizationId', constraints: false });
    prescriptions.belongsTo(users, { foreignKey: 'medicId', constraints: false });
    prescriptions.belongsTo(patients, { foreignKey: 'patientId', constraints: false });
  };

  return prescriptions;
}
