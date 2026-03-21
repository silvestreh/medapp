import { Sequelize, DataTypes, Model } from 'sequelize';
import { Application } from '../declarations';
import { HookReturn } from 'sequelize/types/hooks';

export default function (app: Application): typeof Model {
  const sequelizeClient: Sequelize = app.get('sequelizeClient');
  const practice_codes = sequelizeClient.define('practice_codes', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    practiceId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'practices',
        key: 'id'
      }
    },
    userId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    insurerId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'prepagas',
        key: 'id'
      }
    },
    code: {
      type: DataTypes.STRING,
      allowNull: false
    }
  }, {
    indexes: [
      {
        name: 'practice_codes_unique',
        unique: true,
        fields: ['practiceId', 'userId', 'insurerId']
      },
      {
        name: 'practice_codes_user',
        fields: ['userId']
      },
      {
        name: 'practice_codes_practice',
        fields: ['practiceId']
      }
    ],
    hooks: {
      beforeCount(options: any): HookReturn {
        options.raw = true;
      }
    }
  });

  (practice_codes as any).associate = function (models: any): void {
    const { practices, users, prepagas } = models;
    practice_codes.belongsTo(practices, { foreignKey: 'practiceId' });
    practice_codes.belongsTo(users, { foreignKey: 'userId' });
    practice_codes.belongsTo(prepagas, { foreignKey: 'insurerId' });
  };

  return practice_codes;
}
