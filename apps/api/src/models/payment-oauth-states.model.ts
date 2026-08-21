import { Sequelize, DataTypes, Model } from 'sequelize';
import { makeDefine } from '@athelas/encryption';
import { Application } from '../declarations';
import { HookReturn } from 'sequelize/types/hooks';
import { getPaymentsConfig } from '../utils/payments-config';

// Short-lived, single-use OAuth state rows (CSRF protection + PKCE verifier
// storage — the API has no session store). The state is cryptographically
// random, bound to the professional who started the flow, expires in minutes,
// and is consumed atomically on callback. Rows are purged by the payment
// hold-expiry cron.
const PLACEHOLDER_KEY = 'payments-key-not-configured';

export default function (app: Application): typeof Model {
  const sequelizeClient: Sequelize = app.get('sequelizeClient');
  const encryptionKey = getPaymentsConfig(app).encryptionKey || PLACEHOLDER_KEY;
  const define = makeDefine(sequelizeClient, encryptionKey);

  const payment_oauth_states = define('payment_oauth_states', {
    state: {
      type: DataTypes.STRING,
      primaryKey: true
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
    codeVerifier: {
      type: DataTypes.BLOB,
      allowNull: false
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false
    },
    usedAt: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    encryptedFields: ['codeVerifier'],
    hooks: {
      beforeCount(options: any): HookReturn {
        options.raw = true;
      }
    }
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (payment_oauth_states as any).associate = function (models: any): void {
    const { users } = models;
    payment_oauth_states.belongsTo(users, { foreignKey: 'userId' });
  };

  return payment_oauth_states as unknown as typeof Model;
}
