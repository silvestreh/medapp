import { Sequelize, DataTypes, Model } from 'sequelize';
import { Application } from '../declarations';
import { HookReturn } from 'sequelize/types/hooks';

export default function (app: Application): typeof Model {
  const sequelizeClient: Sequelize = app.get('sequelizeClient');
  const sireDoseLogs = sequelizeClient.define('sire_dose_logs', {
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
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    taken: {
      type: DataTypes.BOOLEAN,
      allowNull: false
    },
    expectedDose: {
      type: DataTypes.FLOAT,
      allowNull: true,
      comment: 'Tablet fraction that was scheduled for this day'
    }
  }, {
    hooks: {
      beforeCount(options: any): HookReturn {
        options.raw = true;
      }
    }
  });

  (sireDoseLogs as any).associate = function (models: any): void {
    const { sire_treatments, patients } = models;
    sireDoseLogs.belongsTo(sire_treatments, { foreignKey: 'treatmentId' });
    sireDoseLogs.belongsTo(patients, { foreignKey: 'patientId' });
  };

  return sireDoseLogs;
}
