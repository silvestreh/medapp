// See https://sequelize.org/master/manual/model-basics.html
// for more of what you can do here.
import { Sequelize, DataTypes, Model } from 'sequelize';
import { Application } from '../declarations';
import { HookReturn } from 'sequelize/types/hooks';

export default function (app: Application): typeof Model {
  const sequelizeClient: Sequelize = app.get('sequelizeClient');
  const users = sequelizeClient.define('users', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false
    },
    twoFactorEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    twoFactorSecret: {
      type: DataTypes.STRING,
      allowNull: true
    },
    twoFactorTempSecret: {
      type: DataTypes.STRING,
      allowNull: true
    },
    roleId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'roles',
        key: 'id'
      }
    },
    currentChallenge: {
      type: DataTypes.STRING,
      allowNull: true
    }
  }, {
    hooks: {
      beforeCount(options: any): HookReturn {
        options.raw = true;
      }
    }
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (users as any).associate = function (models: any): void {
    const {
      personal_data,
      contact_data,
      md_settings,
      encounters,
      user_personal_data,
      user_contact_data,
      user_roles,
      roles,
      studies,
      time_off_events,
      passkey_credentials
    } = models;

    users.belongsToMany(personal_data, {
      through: {
        model: user_personal_data,
        unique: true
      },
      foreignKey: 'ownerId',
      otherKey: 'personalDataId'
    });
    users.belongsToMany(contact_data, {
      through: {
        model: user_contact_data,
        unique: true
      },
      foreignKey: 'ownerId',
      otherKey: 'contactDataId'
    });
    users.hasOne(md_settings, { foreignKey: 'userId', constraints: false });
    users.hasMany(encounters, {
      foreignKey: 'medicId',
      constraints: false
    });
    users.belongsTo(roles, { foreignKey: 'roleId' });
    users.belongsToMany(roles, {
      through: { model: user_roles, unique: true },
      foreignKey: 'userId',
      otherKey: 'roleId',
      as: 'additionalRoles'
    });
    users.hasMany(studies, {
      foreignKey: 'medicId',
      constraints: false
    });
    users.hasMany(time_off_events, {
      foreignKey: 'medicId',
      constraints: false
    });
    users.hasMany(passkey_credentials, {
      foreignKey: 'userId',
      constraints: false
    });
  };

  return users;
}
