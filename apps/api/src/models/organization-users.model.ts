import { Sequelize, DataTypes, Model } from 'sequelize';
import { Application } from '../declarations';

export default function (app: Application): typeof Model {
  const sequelizeClient: Sequelize = app.get('sequelizeClient');
  const organizationUsers = sequelizeClient.define('organization_users', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    organizationId: {
      type: DataTypes.STRING,
      allowNull: false,
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
    }
  }, {
    indexes: [
      {
        unique: true,
        fields: ['organizationId', 'userId']
      }
    ]
  });

  (organizationUsers as any).associate = function (models: any): void {
    const { users, organizations } = models;
    organizationUsers.belongsTo(users, { foreignKey: 'userId' });
    organizationUsers.belongsTo(organizations, { foreignKey: 'organizationId' });
  };

  return organizationUsers;
}
