import { Sequelize, DataTypes, Model } from 'sequelize';
import { Application } from '../declarations';

export default function (app: Application): typeof Model {
  const sequelizeClient: Sequelize = app.get('sequelizeClient');
  const userContactData = sequelizeClient.define('user_contact_data', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    ownerId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    contactDataId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'contact_data',
        key: 'id'
      }
    }
  });

  (userContactData as any).associate = function (models: any): void {
    const { users, contact_data } = models;

    userContactData.belongsTo(users, { foreignKey: 'ownerId' });
    userContactData.belongsTo(contact_data, { foreignKey: 'contactDataId' });
  };

  return userContactData;
}
