import { Sequelize, DataTypes, Model } from 'sequelize';
import { Application } from '../declarations';
import { HookReturn } from 'sequelize/types/hooks';

export default function (app: Application): typeof Model {
  const sequelizeClient: Sequelize = app.get('sequelizeClient');
  const appointments = sequelizeClient.define('appointments', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    organizationId: {
      type: DataTypes.STRING,
      allowNull: true,
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
    patientId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'patients',
        key: 'id'
      }
    },
    startDate: {
      type: DataTypes.DATE,
      allowNull: false
    },
    extra: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    status: {
      type: DataTypes.ENUM('pending_payment', 'confirmed', 'cancelled', 'expired'),
      allowNull: false,
      defaultValue: 'confirmed'
    },
    holdExpiresAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    paidAt: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    hooks: {
      beforeCount(options: any): HookReturn {
        options.raw = true;
      }
    },
    indexes: [
      {
        // Only rows that actually occupy a slot participate; cancelled/expired
        // rows must not block rebooking, and sobreturnos are double-booked on
        // purpose. Production can't get this via sync — see the mirrored raw
        // SQL in sequelize.ts and the migration runbook.
        name: 'appointments_medic_slot_active_unique',
        unique: true,
        fields: ['medicId', 'startDate'],
        where: {
          status: ['pending_payment', 'confirmed'],
          extra: false
        }
      },
      {
        // cron/payment-hold-expiry.ts sweeps lapsed holds every minute; keep
        // that off a full-table scan. Mirrored in sequelize.ts / the runbook.
        name: 'appointments_hold_expiry_idx',
        fields: ['holdExpiresAt'],
        where: { status: ['pending_payment', 'expired'] }
      }
    ]
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (appointments as any).associate = function (models: any): void {
    const { users, patients, organizations } = models;
    appointments.belongsTo(organizations, { foreignKey: 'organizationId' });
    appointments.belongsTo(users, { foreignKey: 'medicId' });
    appointments.belongsTo(patients, { foreignKey: 'patientId' });
  };

  return appointments;
}
