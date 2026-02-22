import { Sequelize, DataTypes, Model } from 'sequelize';
import { Application } from '../declarations';

export default function (app: Application): typeof Model {
  const sequelizeClient: Sequelize = app.get('sequelizeClient');
  const invites = sequelizeClient.define('invites', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false
    },
    organizationId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'organizations',
        key: 'id'
      }
    },
    role: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'member'
    },
    invitedBy: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    userId: {
      type: DataTypes.STRING,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    token: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    status: {
      type: DataTypes.ENUM('pending', 'accepted', 'expired', 'cancelled'),
      allowNull: false,
      defaultValue: 'pending'
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false
    },
    isNewUser: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    }
  });

  (invites as any).associate = function (models: any): void {
    const { users, organizations } = models;
    invites.belongsTo(organizations, { foreignKey: 'organizationId' });
    invites.belongsTo(users, { foreignKey: 'invitedBy', as: 'inviter' });
    invites.belongsTo(users, { foreignKey: 'userId', as: 'invitedUser' });
  };

  return invites;
}
