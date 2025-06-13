import { Sequelize, DataTypes, Model } from 'sequelize';
import { Application } from '../declarations';
import { HookReturn } from 'sequelize/types/hooks';

export default function (app: Application): typeof Model {
  const sequelizeClient: Sequelize = app.get('sequelizeClient');
  const md_settings = sequelizeClient.define('md_settings', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    userId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    medicalSpecialty: {
      type: DataTypes.STRING,
      allowNull: true
    },
    nationalLicenseNumber: {
      type: DataTypes.STRING,
      allowNull: true
    },
    stateLicense: {
      type: DataTypes.STRING,
      allowNull: true
    },
    stateLicenseNumber: {
      type: DataTypes.STRING,
      allowNull: true
    },
    mondayStart: {
      type: DataTypes.TIME,
      allowNull: true,
    },
    mondayEnd: {
      type: DataTypes.TIME,
      allowNull: true,
    },
    tuesdayStart: {
      type: DataTypes.TIME,
      allowNull: true,
    },
    tuesdayEnd: {
      type: DataTypes.TIME,
      allowNull: true,
    },
    wednesdayStart: {
      type: DataTypes.TIME,
      allowNull: true,
    },
    wednesdayEnd: {
      type: DataTypes.TIME,
      allowNull: true,
    },
    thursdayStart: {
      type: DataTypes.TIME,
      allowNull: true,
    },
    thursdayEnd: {
      type: DataTypes.TIME,
      allowNull: true,
    },
    fridayStart: {
      type: DataTypes.TIME,
      allowNull: true,
    },
    fridayEnd: {
      type: DataTypes.TIME,
      allowNull: true,
    },
    saturdayStart: {
      type: DataTypes.TIME,
      allowNull: true,
    },
    saturdayEnd: {
      type: DataTypes.TIME,
      allowNull: true,
    },
    sundayStart: {
      type: DataTypes.TIME,
      allowNull: true,
    },
    sundayEnd: {
      type: DataTypes.TIME,
      allowNull: true,
    },
    encounterDuration: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  }, {
    hooks: {
      beforeCount(options: any): HookReturn {
        options.raw = true;
      }
    }
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (md_settings as any).associate = function (models: any): void {
    const { users } = models;
    md_settings.belongsTo(users, { foreignKey: 'userId' });
  };

  return md_settings;
}
