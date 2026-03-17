import { Sequelize, DataTypes, Model } from 'sequelize';
import { Application } from '../declarations';
import { HookReturn } from 'sequelize/types/hooks';

export default function (app: Application): typeof Model {
  const sequelizeClient: Sequelize = app.get('sequelizeClient');
  const sireReadings = sequelizeClient.define('sire_readings', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    treatmentId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'sire_treatments',
        key: 'id'
      }
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
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    inr: {
      type: DataTypes.FLOAT,
      allowNull: false
    },
    quick: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    percentage: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    source: {
      type: DataTypes.ENUM('provider', 'patient', 'lab'),
      allowNull: false,
      defaultValue: 'provider'
    }
  }, {
    hooks: {
      beforeCount(options: any): HookReturn {
        options.raw = true;
      }
    }
  });

  (sireReadings as any).associate = function (models: any): void {
    const { sire_treatments, patients, organizations } = models;
    sireReadings.belongsTo(sire_treatments, { foreignKey: 'treatmentId' });
    sireReadings.belongsTo(patients, { foreignKey: 'patientId' });
    sireReadings.belongsTo(organizations, { foreignKey: 'organizationId' });
  };

  return sireReadings;
}
