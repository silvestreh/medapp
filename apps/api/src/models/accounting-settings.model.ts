import { Sequelize, DataTypes, Model } from 'sequelize';
import { Application } from '../declarations';
import { HookReturn } from 'sequelize/types/hooks';

export default function (app: Application): typeof Model {
  const sequelizeClient: Sequelize = app.get('sequelizeClient');
  const accounting_settings = sequelizeClient.define('accounting_settings', {
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
    userId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    insurerPrices: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
  }, {
    hooks: {
      beforeCount(options: any): HookReturn {
        options.raw = true;
      }
    }
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (accounting_settings as any).associate = function (models: any): void {
    const { users, organizations } = models;
    accounting_settings.belongsTo(organizations, { foreignKey: 'organizationId' });
    accounting_settings.belongsTo(users, { foreignKey: 'userId' });
  };

  return accounting_settings;
}
