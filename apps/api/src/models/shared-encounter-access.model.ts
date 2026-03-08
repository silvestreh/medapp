import { Sequelize, DataTypes, Model } from 'sequelize';
import { Application } from '../declarations';

export default function (app: Application): typeof Model {
  const sequelizeClient: Sequelize = app.get('sequelizeClient');
  const sharedEncounterAccess = sequelizeClient.define('shared_encounter_access', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    grantingMedicId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    grantedMedicId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'users',
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
    },
    organizationId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'organizations',
        key: 'id'
      }
    }
  }, {
    indexes: [
      {
        unique: true,
        fields: ['grantingMedicId', 'grantedMedicId', 'patientId', 'organizationId']
      },
      {
        fields: ['grantedMedicId']
      }
    ]
  });

  (sharedEncounterAccess as any).associate = function (models: any): void {
    const { users, patients, organizations } = models;
    sharedEncounterAccess.belongsTo(users, {
      foreignKey: 'grantingMedicId',
      as: 'grantingMedic'
    });
    sharedEncounterAccess.belongsTo(users, {
      foreignKey: 'grantedMedicId',
      as: 'grantedMedic'
    });
    sharedEncounterAccess.belongsTo(patients, { foreignKey: 'patientId' });
    sharedEncounterAccess.belongsTo(organizations, { foreignKey: 'organizationId' });
  };

  return sharedEncounterAccess;
}
