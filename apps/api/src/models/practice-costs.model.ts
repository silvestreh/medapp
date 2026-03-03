import { Sequelize, DataTypes, Model } from 'sequelize';
import { HookReturn } from 'sequelize/types/hooks';

import { Application } from '../declarations';

export default function (app: Application): typeof Model {
  const sequelizeClient: Sequelize = app.get('sequelizeClient');
  const practice_costs = sequelizeClient.define('practice_costs', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    organizationId: {
      type: DataTypes.STRING,
      allowNull: true,
      references: {
        model: 'organizations',
        key: 'id',
      },
    },
    medicId: {
      type: DataTypes.STRING,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    patientId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'patients',
        key: 'id',
      },
    },
    practiceId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    practiceType: {
      type: DataTypes.ENUM('studies', 'encounters'),
      allowNull: false,
    },
    studyType: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    insurerId: {
      type: DataTypes.STRING,
      allowNull: true,
      references: {
        model: 'prepagas',
        key: 'id',
      },
    },
    emergency: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    date: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    cost: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
    },
  }, {
    hooks: {
      beforeCount(options: any): HookReturn {
        options.raw = true;
      },
    },
    indexes: [
      {
        unique: true,
        fields: ['practiceId', 'studyType'],
        name: 'practice_costs_practice_study_type_unique',
      },
      {
        fields: ['organizationId', 'medicId'],
        name: 'practice_costs_org_medic_idx',
      },
      {
        fields: ['date'],
        name: 'practice_costs_date_idx',
      },
    ],
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (practice_costs as any).associate = function (models: any): void {
    practice_costs.belongsTo(models.organizations, {
      foreignKey: 'organizationId',
      constraints: false,
    });
    practice_costs.belongsTo(models.users, {
      foreignKey: 'medicId',
      constraints: false,
    });
    practice_costs.belongsTo(models.prepagas, {
      foreignKey: 'insurerId',
      constraints: false,
    });
    practice_costs.belongsTo(models.patients, {
      foreignKey: 'patientId',
      constraints: false,
    });
  };

  return practice_costs;
}
