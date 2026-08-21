import { Sequelize, DataTypes, Model } from 'sequelize';
import { makeDefine } from '@athelas/encryption';
import { Application } from '../declarations';
import { HookReturn } from 'sequelize/types/hooks';
import { getPaymentsConfig } from '../utils/payments-config';

// A professional's delegated payment-processor credentials. userId-scoped on
// purpose: the Mercado Pago account is the person's own (funds always land
// there directly), so one OAuth connection serves every organization they
// work in. Tokens are encrypted with PAYMENTS_ENCRYPTION_KEY — a separate key
// from the clinical-records ENCRYPTION_KEY, enforced by
// utils/validate-payments-config.ts at boot.
//
// When payments are unconfigured the placeholder key lets the app boot; no
// row can be written in that state because the OAuth flow requires the
// Mercado Pago config to exist.
const PLACEHOLDER_KEY = 'payments-key-not-configured';

export default function (app: Application): typeof Model {
  const sequelizeClient: Sequelize = app.get('sequelizeClient');
  const encryptionKey = getPaymentsConfig(app).encryptionKey || PLACEHOLDER_KEY;
  const define = makeDefine(sequelizeClient, encryptionKey);

  const payment_connections = define('payment_connections', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    userId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    provider: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'mercado_pago'
    },
    status: {
      type: DataTypes.ENUM('connected', 'refresh_failed', 'disconnected'),
      allowNull: false,
      defaultValue: 'connected'
    },
    accessToken: {
      type: DataTypes.BLOB,
      allowNull: false
    },
    refreshToken: {
      type: DataTypes.BLOB,
      allowNull: true
    },
    providerAccountId: {
      type: DataTypes.STRING,
      allowNull: true
    },
    // Non-sensitive display hint (e.g. "MP ****4821") so the UI can show
    // connection state without ever decrypting anything.
    accountHint: {
      type: DataTypes.STRING,
      allowNull: true
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    lastRefreshedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    refreshFailCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    nextRefreshRetry: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    encryptedFields: ['accessToken', 'refreshToken'],
    hooks: {
      beforeCount(options: any): HookReturn {
        options.raw = true;
      }
    },
    indexes: [
      {
        name: 'payment_connections_user_provider_unique',
        unique: true,
        fields: ['userId', 'provider']
      }
    ]
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (payment_connections as any).associate = function (models: any): void {
    const { users } = models;
    payment_connections.belongsTo(users, { foreignKey: 'userId' });
  };

  return payment_connections as unknown as typeof Model;
}
