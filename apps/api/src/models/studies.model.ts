// See https://sequelize.org/master/manual/model-basics.html
// for more of what you can do here.
import { Sequelize, DataTypes, Model } from 'sequelize';
import { HookReturn } from 'sequelize/types/hooks';

import { Application } from '../declarations';

export default function (app: Application): typeof Model {
  const sequelizeClient: Sequelize = app.get('sequelizeClient');
  const studies = sequelizeClient.define('studies', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    date: {
      type: DataTypes.DATE,
      allowNull: false
    },
    protocol: {
      type: DataTypes.INTEGER,
      unique: true,
      allowNull: false
    },
    studies: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: false
    },
    noOrder: {
      type: DataTypes.BOOLEAN,
      allowNull: false
    },
    medicId: {
      type: DataTypes.STRING,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    referringDoctor: {
      type: DataTypes.STRING,
      allowNull: true
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
    hooks: {
      beforeCount(options: any): HookReturn {
        options.raw = true;
      }
    }
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (studies as any).associate = function (models: any): void {
    studies.hasMany(models.study_results, { foreignKey: 'studyId' });
  };

  return studies;
}
