// See https://sequelize.org/master/manual/model-basics.html
// for more of what you can do here.
import { Sequelize, DataTypes, Model } from 'sequelize';
import { HookReturn } from 'sequelize/types/hooks';

import { Application } from '../declarations';
import { makeDefine } from '../sequelize';

export default function (app: Application): typeof Model {
  const sequelizeClient: Sequelize = app.get('sequelizeClient');
  const define = makeDefine(sequelizeClient);
  const studyResults = define('study_results', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    data: {
      type: DataTypes.BLOB,
      allowNull: true
    },
    studyId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'studies',
        key: 'id'
      }
    },
    type: {
      type: DataTypes.STRING,
      allowNull: false
    }
  }, {
    encryptedFields: ['data'],
    hooks: {
      beforeCount(options: any): HookReturn {
        options.raw = true;
      }
    }
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (studyResults as any).associate = function (models: any): void {
    const { studies } = models;
    studyResults.belongsTo(studies, { foreignKey: 'studyId' });
  };

  return studyResults;
}
