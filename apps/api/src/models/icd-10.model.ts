import { Sequelize, DataTypes, Model } from 'sequelize';
import { Application } from '../declarations';
import { HookReturn } from 'sequelize/types/hooks';

export default function (app: Application): typeof Model {
  const sequelizeClient: Sequelize = app.get('sequelizeClient');
  const icd10 = sequelizeClient.define('icd_10', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false
    },
    name: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    parent: {
      type: DataTypes.STRING,
      allowNull: true
    },
    children: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: []
    }
  }, {
    hooks: {
      beforeCount(options: any): HookReturn {
        options.raw = true;
      }
    },
    underscored: false
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (icd10 as any).associate = function (models: any): void {
    // Define associations here
    // See http://docs.sequelizejs.com/en/latest/docs/associations/
  };

  return icd10;
}
