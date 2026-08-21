import { Sequelize, DataTypes, Model } from 'sequelize';
import { Application } from '../declarations';
import { HookReturn } from 'sequelize/types/hooks';

// Per-professional, per-practice payment collection config. Deliberately
// (userId, organizationId)-scoped — same medic, different fee policy per
// practice — matching accounting_settings, where the consultation fee itself
// lives (insurerPrices._particular.encounter). Holds NO fee and NO secrets.
export default function (app: Application): typeof Model {
  const sequelizeClient: Sequelize = app.get('sequelizeClient');
  const payment_settings = sequelizeClient.define('payment_settings', {
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
    organizationId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'organizations',
        key: 'id'
      }
    },
    enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    chargePortion: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 100
    },
    requirementMode: {
      type: DataTypes.ENUM('optional', 'required'),
      allowNull: false,
      defaultValue: 'optional'
    },
    holdWindowMinutes: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 20
    }
  }, {
    hooks: {
      beforeCount(options: any): HookReturn {
        options.raw = true;
      }
    },
    indexes: [
      {
        name: 'payment_settings_user_org_unique',
        unique: true,
        fields: ['userId', 'organizationId']
      }
    ]
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (payment_settings as any).associate = function (models: any): void {
    const { users, organizations } = models;
    payment_settings.belongsTo(users, { foreignKey: 'userId' });
    payment_settings.belongsTo(organizations, { foreignKey: 'organizationId' });
  };

  return payment_settings;
}
