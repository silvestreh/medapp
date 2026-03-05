import { Sequelize, DataTypes, Model } from 'sequelize';
import { Application } from '../declarations';
import { HookReturn } from 'sequelize/types/hooks';

export default function (app: Application): typeof Model {
  const sequelizeClient: Sequelize = app.get('sequelizeClient');
  const prepagas = sequelizeClient.define('prepagas', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    registry: {
      type: DataTypes.STRING,
      allowNull: true
    },
    denomination: {
      type: DataTypes.STRING,
      allowNull: false
    },
    shortName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    tiers: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: []
    },
    recetarioHealthInsuranceName: {
      type: DataTypes.STRING,
      allowNull: true
    }
  }, {
    hooks: {
      beforeCount(options: any): HookReturn {
        options.raw = true;
      }
    },
    underscored: false
  });

  return prepagas;
}
