import { Sequelize, DataTypes, Model } from 'sequelize';
import { Application } from '../declarations';

export default function (app: Application): typeof Model {
  const sequelizeClient: Sequelize = app.get('sequelizeClient');
  const prescriptionDelegations = sequelizeClient.define('prescription_delegations', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    medicId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    prescriberId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'users',
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
        name: 'prescription_delegation_unique',
        unique: true,
        fields: ['medicId', 'prescriberId', 'organizationId']
      },
      {
        name: 'prescription_delegation_prescriber',
        fields: ['prescriberId']
      }
    ]
  });

  (prescriptionDelegations as any).associate = function (models: any): void {
    const { users, organizations } = models;
    prescriptionDelegations.belongsTo(users, {
      foreignKey: 'medicId',
      as: 'medic'
    });
    prescriptionDelegations.belongsTo(users, {
      foreignKey: 'prescriberId',
      as: 'prescriber'
    });
    prescriptionDelegations.belongsTo(organizations, { foreignKey: 'organizationId' });
  };

  return prescriptionDelegations;
}
