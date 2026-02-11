import { Sequelize, DataTypes, Model } from 'sequelize';
import { Application } from '../declarations';
import { HookReturn } from 'sequelize/types/hooks';

export default function (app: Application): typeof Model {
  const sequelizeClient: Sequelize = app.get('sequelizeClient');
  const medications = sequelizeClient.define('medications', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    commercialNamePresentation: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    genericDrug: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    pharmaceuticalForm: {
      type: DataTypes.STRING,
      allowNull: true
    },
    certificateNumber: {
      type: DataTypes.STRING,
      allowNull: true
    },
    gtin: {
      type: DataTypes.STRING,
      allowNull: true
    },
    availability: {
      type: DataTypes.STRING,
      allowNull: true
    },
    laboratoryId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'laboratories',
        key: 'id'
      }
    },
    searchText: {
      type: DataTypes.TEXT,
      allowNull: true // Will be populated by generated column in SQL
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
  (medications as any).associate = function (models: any): void {
    medications.belongsTo(models.laboratories, { foreignKey: 'laboratoryId' });
  };

  return medications;
}
