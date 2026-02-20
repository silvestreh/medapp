import { Sequelize, DataTypes, Model } from 'sequelize';
import { Application } from '../declarations';
import { HookReturn } from 'sequelize/types/hooks';

export default function (app: Application): typeof Model {
  const sequelizeClient: Sequelize = app.get('sequelizeClient');
  const passkeyCredentials = sequelizeClient.define('passkey_credentials', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    credentialId: {
      type: DataTypes.TEXT,
      allowNull: false,
      unique: true
    },
    publicKey: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    counter: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 0
    },
    transports: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    deviceName: {
      type: DataTypes.STRING,
      allowNull: true
    },
    userId: {
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

  (passkeyCredentials as any).associate = function (models: any): void {
    const { users } = models;
    passkeyCredentials.belongsTo(users, { foreignKey: 'userId' });
  };

  return passkeyCredentials;
}
