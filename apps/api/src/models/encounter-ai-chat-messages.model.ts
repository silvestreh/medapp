import { Sequelize, DataTypes, Model } from 'sequelize';
import { HookReturn } from 'sequelize/types/hooks';

import { Application } from '../declarations';
import { makeDefine } from '../sequelize';

export default function (app: Application): typeof Model {
  const sequelizeClient: Sequelize = app.get('sequelizeClient');
  const define = makeDefine(sequelizeClient);
  const encounterAiChatMessages = define('encounter_ai_chat_messages', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    organizationId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'organizations',
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
    medicId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    role: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    model: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    suggestions: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
  }, {
    hooks: {
      beforeCount(options: any): HookReturn {
        options.raw = true;
      },
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (encounterAiChatMessages as any).associate = function (models: any): void {
    const { organizations, users, patients } = models;
    encounterAiChatMessages.belongsTo(organizations, {
      foreignKey: 'organizationId',
      constraints: false,
    });
    encounterAiChatMessages.belongsTo(users, {
      foreignKey: 'medicId',
      constraints: false,
    });
    encounterAiChatMessages.belongsTo(patients, {
      foreignKey: 'patientId',
      constraints: false,
    });
  };

  return encounterAiChatMessages;
}

