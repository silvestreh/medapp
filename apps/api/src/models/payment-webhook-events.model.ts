import { Sequelize, DataTypes, Model } from 'sequelize';
import { Application } from '../declarations';
import { HookReturn } from 'sequelize/types/hooks';

// Durable webhook idempotency: providers retry and duplicate notifications,
// so every incoming event is insert-first — the unique (provider,
// providerEventId) index makes a duplicate delivery a recorded no-op that
// survives process restarts (unlike an in-memory Set).
export default function (app: Application): typeof Model {
  const sequelizeClient: Sequelize = app.get('sequelizeClient');
  const payment_webhook_events = sequelizeClient.define('payment_webhook_events', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    provider: {
      type: DataTypes.STRING,
      allowNull: false
    },
    providerEventId: {
      type: DataTypes.STRING,
      allowNull: false
    },
    topic: {
      type: DataTypes.STRING,
      allowNull: true
    },
    appointmentPaymentId: {
      type: DataTypes.STRING,
      allowNull: true
    },
    receivedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    processedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    outcome: {
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
      {
        name: 'payment_webhook_events_provider_event_unique',
        unique: true,
        fields: ['provider', 'providerEventId']
      }
    ]
  });

  return payment_webhook_events;
}
