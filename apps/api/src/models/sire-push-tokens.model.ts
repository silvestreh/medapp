import { Sequelize, DataTypes, Model } from 'sequelize';
import { Application } from '../declarations';
import { HookReturn } from 'sequelize/types/hooks';

export default function (app: Application): typeof Model {
  const sequelizeClient: Sequelize = app.get('sequelizeClient');
  const sirePushTokens = sequelizeClient.define('sire_push_tokens', {
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
    token: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    deviceName: {
      type: DataTypes.STRING,
      allowNull: true
    },
    platform: {
      type: DataTypes.ENUM('ios', 'android'),
      allowNull: true
    },
    doseReminders: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    }
  }, {
    hooks: {
      beforeCount(options: any): HookReturn {
        options.raw = true;
      }
    }
  });

  (sirePushTokens as any).associate = function (models: any): void {
    const { patients } = models;
    sirePushTokens.belongsTo(patients, { foreignKey: 'patientId' });
  };

  return sirePushTokens;
}
