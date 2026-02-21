import { Sequelize, DataTypes, Model } from 'sequelize';
import { Application } from '../declarations';
import { HookReturn } from 'sequelize/types/hooks';

export default function (app: Application): typeof Model {
  const sequelizeClient: Sequelize = app.get('sequelizeClient');
  const organizations = sequelizeClient.define('organizations', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    slug: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    settings: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {}
    }
  }, {
    hooks: {
      beforeCount(options: any): HookReturn {
        options.raw = true;
      }
    }
  });

  (organizations as any).associate = function (models: any): void {
    const { users, patients, organization_users, organization_patients } = models;

    organizations.belongsToMany(users, {
      through: { model: organization_users, unique: true },
      foreignKey: 'organizationId',
      otherKey: 'userId',
      as: 'members'
    });
    organizations.belongsToMany(patients, {
      through: { model: organization_patients, unique: true },
      foreignKey: 'organizationId',
      otherKey: 'patientId',
      as: 'orgPatients'
    });
  };

  return organizations;
}
