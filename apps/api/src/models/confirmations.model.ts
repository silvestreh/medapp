import { Sequelize, DataTypes, Model } from 'sequelize';
import { Application } from '../declarations';

export default function (app: Application): typeof Model {
  const sequelizeClient: Sequelize = app.get('sequelizeClient');
  const confirmations = sequelizeClient.define('confirmations', {
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
    type: {
      type: DataTypes.ENUM('password-reset', 'email-verification'),
      allowNull: false
    },
    token: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    status: {
      type: DataTypes.ENUM('pending', 'used', 'expired'),
      allowNull: false,
      defaultValue: 'pending'
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false
    }
  });

  (confirmations as any).associate = function (models: any): void {
    confirmations.belongsTo(models.users, { foreignKey: 'userId' });
  };

  return confirmations;
}
