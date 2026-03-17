import { Sequelize, DataTypes, Model } from 'sequelize';
import { Application } from '../declarations';
import { HookReturn } from 'sequelize/types/hooks';

export default function (app: Application): typeof Model {
  const sequelizeClient: Sequelize = app.get('sequelizeClient');
  const sireTreatments = sequelizeClient.define('sire_treatments', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    patientId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'patients',
        key: 'id'
      }
    },
    organizationId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'organizations',
        key: 'id'
      }
    },
    medicId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    medication: {
      type: DataTypes.STRING,
      allowNull: false
    },
    tabletDoseMg: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 4
    },
    indication: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    targetInrMin: {
      type: DataTypes.FLOAT,
      allowNull: false
    },
    targetInrMax: {
      type: DataTypes.FLOAT,
      allowNull: false
    },
    startDate: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    endDate: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('active', 'paused', 'completed'),
      allowNull: false,
      defaultValue: 'active'
    },
    nextControlDate: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    hooks: {
      beforeCount(options: any): HookReturn {
        options.raw = true;
      }
    }
  });

  (sireTreatments as any).associate = function (models: any): void {
    const { patients, organizations, users } = models;
    sireTreatments.belongsTo(patients, { foreignKey: 'patientId' });
    sireTreatments.belongsTo(organizations, { foreignKey: 'organizationId' });
    sireTreatments.belongsTo(users, { foreignKey: 'medicId' });
  };

  return sireTreatments;
}
