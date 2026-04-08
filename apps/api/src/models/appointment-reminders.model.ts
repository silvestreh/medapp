import { Sequelize, DataTypes, Model } from 'sequelize';
import { Application } from '../declarations';

export default function (app: Application): typeof Model {
  const sequelizeClient: Sequelize = app.get('sequelizeClient');
  const appointment_reminders = sequelizeClient.define('appointment_reminders', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    appointmentId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      references: {
        model: 'appointments',
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
    patientId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'patients',
        key: 'id'
      }
    },
    sentAt: {
      type: DataTypes.DATE,
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('sent', 'failed', 'skipped'),
      allowNull: false
    },
    messageId: {
      type: DataTypes.STRING,
      allowNull: true
    },
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  });

  (appointment_reminders as any).associate = function (models: any): void {
    appointment_reminders.belongsTo(models.appointments, { foreignKey: 'appointmentId' });
    appointment_reminders.belongsTo(models.organizations, { foreignKey: 'organizationId' });
    appointment_reminders.belongsTo(models.patients, { foreignKey: 'patientId' });
  };

  return appointment_reminders;
}
