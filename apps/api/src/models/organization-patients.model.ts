import { Sequelize, DataTypes, Model } from 'sequelize';
import { Application } from '../declarations';

export default function (app: Application): typeof Model {
  const sequelizeClient: Sequelize = app.get('sequelizeClient');
  const organizationPatients = sequelizeClient.define('organization_patients', {
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
    patientId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'patients',
        key: 'id'
      }
    }
  }, {
    indexes: [
      {
        unique: true,
        fields: ['organizationId', 'patientId']
      }
    ]
  });

  (organizationPatients as any).associate = function (models: any): void {
    const { patients, organizations } = models;
    organizationPatients.belongsTo(patients, { foreignKey: 'patientId' });
    organizationPatients.belongsTo(organizations, { foreignKey: 'organizationId' });
  };

  return organizationPatients;
}
