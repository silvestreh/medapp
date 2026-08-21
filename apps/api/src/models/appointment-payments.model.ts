import { Sequelize, DataTypes, Model } from 'sequelize';
import { Application } from '../declarations';
import { HookReturn } from 'sequelize/types/hooks';

// One row per payment attempt attached to a booking. Holds NO card or bank
// data — only provider ids and our own snapshotted amounts (integer minor
// units, never floats). medicId/patientId/organizationId/appointmentStartDate
// are denormalized so the financial record stays meaningful after the
// appointment row is hard-deleted (patient cancellation, or the 3-month
// cleanup cron) — hence the nullable FK with SET NULL.
export default function (app: Application): typeof Model {
  const sequelizeClient: Sequelize = app.get('sequelizeClient');
  const appointment_payments = sequelizeClient.define('appointment_payments', {
    id: {
      // Doubles as the provider-side external_reference.
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    appointmentId: {
      type: DataTypes.STRING,
      allowNull: true,
      references: {
        model: 'appointments',
        key: 'id'
      },
      onDelete: 'SET NULL'
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
    organizationId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'organizations',
        key: 'id'
      }
    },
    appointmentStartDate: {
      type: DataTypes.DATE,
      allowNull: false
    },
    provider: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'mercado_pago'
    },
    providerAccountId: {
      type: DataTypes.STRING,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('pending', 'in_process', 'approved', 'rejected', 'cancelled', 'expired', 'refunded', 'charged_back'),
      allowNull: false,
      defaultValue: 'pending'
    },
    // Phase-2 seam: which resolver produced the amount ('private_fee' now,
    // an insurer-derived coseguro resolver later).
    amountResolver: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'private_fee'
    },
    feeMinorSnapshot: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    chargePortionSnapshot: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    amount: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    currency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: 'ARS'
    },
    idempotencyKey: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    providerPreferenceId: {
      type: DataTypes.STRING,
      allowNull: true
    },
    providerPaymentId: {
      type: DataTypes.STRING,
      allowNull: true
    },
    checkoutUrl: {
      type: DataTypes.STRING(1024),
      allowNull: true
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    paidAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    refundStatus: {
      type: DataTypes.ENUM('requested', 'completed', 'failed'),
      allowNull: true
    },
    refundedAmount: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    flagged: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    flagReason: {
      type: DataTypes.STRING,
      allowNull: true
    }
  }, {
    hooks: {
      beforeCount(options: any): HookReturn {
        options.raw = true;
      }
    },
    indexes: [
      { fields: ['appointmentId'] },
      { fields: ['providerPaymentId'] },
      { fields: ['medicId', 'organizationId', 'createdAt'] },
      { fields: ['status', 'expiresAt'] }
    ]
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (appointment_payments as any).associate = function (models: any): void {
    const { appointments, users, patients, organizations } = models;
    appointment_payments.belongsTo(appointments, { foreignKey: 'appointmentId', onDelete: 'SET NULL' });
    appointment_payments.belongsTo(users, { foreignKey: 'medicId' });
    appointment_payments.belongsTo(patients, { foreignKey: 'patientId' });
    appointment_payments.belongsTo(organizations, { foreignKey: 'organizationId' });
  };

  return appointment_payments;
}
