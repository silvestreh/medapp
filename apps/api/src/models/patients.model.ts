import { Sequelize, DataTypes, Model } from 'sequelize';
import { Application } from '../declarations';
import { HookReturn } from 'sequelize/types/hooks';

export default function (app: Application): typeof Model {
  const sequelizeClient: Sequelize = app.get('sequelizeClient');
  const patients = sequelizeClient.define('patients', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    mugshot: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    medicare: {
      type: DataTypes.STRING,
      allowNull: true
    },
    medicareId: {
      type: DataTypes.STRING,
      allowNull: true,
      references: {
        model: 'prepagas',
        key: 'id'
      }
    },
    medicareNumber: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    medicarePlan: {
      type: DataTypes.STRING,
      allowNull: true
    },
    deleted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    }
  }, {
    hooks: {
      beforeCount(options: any): HookReturn {
        options.raw = true;
      }
    }
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (patients as any).associate = function (models: any): void {
    const {
      appointments,
      personal_data,
      contact_data,
      encounters,
      patient_personal_data,
      patient_contact_data,
      studies,
      organizations,
      organization_patients,
      prepagas
    } = models;

    patients.hasMany(appointments, { foreignKey: 'patientId' });
    patients.hasMany(encounters, {
      foreignKey: 'patientId',
      constraints: false
    });
    patients.belongsToMany(personal_data, {
      through: {
        model: patient_personal_data,
        unique: true
      },
      foreignKey: 'ownerId',
      otherKey: 'personalDataId'
    });
    patients.belongsToMany(contact_data, {
      through: {
        model: patient_contact_data,
        unique: true
      },
      foreignKey: 'ownerId',
      otherKey: 'contactDataId'
    });
    patients.hasMany(studies, {
      foreignKey: 'patientId',
      constraints: false
    });
    patients.belongsToMany(organizations, {
      through: { model: organization_patients, unique: true },
      foreignKey: 'patientId',
      otherKey: 'organizationId',
      as: 'organizations'
    });
    patients.belongsTo(prepagas, { foreignKey: 'medicareId' });
  };

  return patients;
}
