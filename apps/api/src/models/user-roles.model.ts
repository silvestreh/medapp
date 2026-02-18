import { Sequelize, DataTypes, Model } from 'sequelize';
import { Application } from '../declarations';

export default function (app: Application): typeof Model {
  const sequelizeClient: Sequelize = app.get('sequelizeClient');
  const userRoles = sequelizeClient.define('user_roles', {
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
    roleId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'roles',
        key: 'id'
      }
    }
  });

  (userRoles as any).associate = function (models: any): void {
    const { users, roles } = models;

    userRoles.belongsTo(users, { foreignKey: 'userId' });
    userRoles.belongsTo(roles, { foreignKey: 'roleId' });
  };

  return userRoles;
}
