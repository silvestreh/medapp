import { Sequelize, DataTypes, Model } from 'sequelize';
import { Application } from '../declarations';

export default function (app: Application): typeof Model {
  const sequelizeClient: Sequelize = app.get('sequelizeClient');
  const patientPersonalData = sequelizeClient.define('patient_personal_data', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    ownerId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'patients',
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

  (patientPersonalData as any).associate = function (models: any): void {
    const { patients, personal_data } = models;

    patientPersonalData.belongsTo(patients, { foreignKey: 'ownerId' });
    patientPersonalData.belongsTo(personal_data, { foreignKey: 'personalDataId' });
  };

  return patientPersonalData;
}
