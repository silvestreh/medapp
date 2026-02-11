import { Sequelize, DataTypes, Model } from 'sequelize';
import { Application } from '../declarations';
import { HookReturn } from 'sequelize/types/hooks';

export default function (app: Application): typeof Model {
  const sequelizeClient: Sequelize = app.get('sequelizeClient');
  const laboratories = sequelizeClient.define('laboratories', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
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
  (laboratories as any).associate = function (models: any): void {
    laboratories.hasMany(models.medications, { foreignKey: 'laboratoryId' });
  };

  return laboratories;
}
