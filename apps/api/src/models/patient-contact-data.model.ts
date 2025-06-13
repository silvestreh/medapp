import { Sequelize, DataTypes, Model } from 'sequelize';
import { Application } from '../declarations';

export default function (app: Application): typeof Model {
  const sequelizeClient: Sequelize = app.get('sequelizeClient');
  const patientContactData = sequelizeClient.define('patient_contact_data', {
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
    contactDataId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'contact_data',
        key: 'id'
      }
    }
  });

  (patientContactData as any).associate = function (models: any): void {
    const { patients, contact_data } = models;

    patientContactData.belongsTo(patients, { foreignKey: 'ownerId' });
    patientContactData.belongsTo(contact_data, { foreignKey: 'contactDataId' });
  };

  return patientContactData;
}
