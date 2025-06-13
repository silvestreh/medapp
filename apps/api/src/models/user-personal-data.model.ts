import { Sequelize, DataTypes, Model } from 'sequelize';
import { Application } from '../declarations';

export default function (app: Application): typeof Model {
  const sequelizeClient: Sequelize = app.get('sequelizeClient');
  const userPersonalData = sequelizeClient.define('user_personal_data', {
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
    personalDataId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'personal_data',
        key: 'id'
      }
    }
  });

  (userPersonalData as any).associate = function (models: any): void {
    const { users, personal_data } = models;

    userPersonalData.belongsTo(users, { foreignKey: 'ownerId' });
    userPersonalData.belongsTo(personal_data, { foreignKey: 'personalDataId' });
  };

  return userPersonalData;
}
