import { Sequelize, DataTypes, Model } from 'sequelize';
import { HookReturn } from 'sequelize/types/hooks';

import { Application } from '../declarations';
import { makeDefine } from '../sequelize';

export default function (app: Application): typeof Model {
  const sequelizeClient: Sequelize = app.get('sequelizeClient');
  const define = makeDefine(sequelizeClient);
  const encounters = define('encounters', {
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
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    patientId: {
      type: DataTypes.STRING,
      allowNull: true,
      references: {
        model: 'patients',
        key: 'id'
      }
    },
    date: {
      type: DataTypes.DATE,
      allowNull: false
    },
    insurerId: {
      type: DataTypes.STRING,
      allowNull: true,
      references: {
        model: 'prepagas',
        key: 'id'
      }
    },
    data: {
      type: DataTypes.BLOB,
      allowNull: true
    },
    hash: {
      type: DataTypes.STRING(64),
      allowNull: true
    },
    previousEncounterId: {
      type: DataTypes.STRING,
      allowNull: true,
      references: {
        model: 'encounters',
        key: 'id'
      }
    }
  }, {
    encryptedFields: ['data'],
    hooks: {
      beforeCount(options: any): HookReturn {
        options.raw = true;
      }
    }
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (encounters as any).associate = function (models: any): void {
    const { users, patients, organizations } = models;
    encounters.belongsTo(organizations, {
      foreignKey: 'organizationId',
      constraints: false
    });
    encounters.belongsTo(users, {
      foreignKey: 'medicId',
      constraints: false
    });
    encounters.belongsTo(patients, {
      foreignKey: 'patientId',
      constraints: false
    });
  };

  return encounters;
}
