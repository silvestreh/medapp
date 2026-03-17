import { Sequelize, DataTypes, Model } from 'sequelize';
import { Application } from '../declarations';
import { HookReturn } from 'sequelize/types/hooks';

export default function (app: Application): typeof Model {
  const sequelizeClient: Sequelize = app.get('sequelizeClient');
  const sireDoseSchedules = sequelizeClient.define('sire_dose_schedules', {
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
    readingId: {
      type: DataTypes.STRING,
      allowNull: true,
      references: {
        model: 'sire_readings',
        key: 'id'
      }
    },
    startDate: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    endDate: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    schedule: {
      type: DataTypes.JSONB,
      allowNull: false,
      comment: 'Tablet fractions per weekday: { monday: 0.5, tuesday: 0.25, ... sunday: null }'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    createdById: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    }
  }, {
    hooks: {
      beforeCount(options: any): HookReturn {
        options.raw = true;
      }
    }
  });

  (sireDoseSchedules as any).associate = function (models: any): void {
    const { sire_treatments, sire_readings, users } = models;
    sireDoseSchedules.belongsTo(sire_treatments, { foreignKey: 'treatmentId' });
    sireDoseSchedules.belongsTo(sire_readings, { foreignKey: 'readingId' });
    sireDoseSchedules.belongsTo(users, { foreignKey: 'createdById' });
  };

  return sireDoseSchedules;
}
