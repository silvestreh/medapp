import { Sequelize, DataTypes, Model } from 'sequelize';
import { Application } from '../declarations';

export default function (app: Application): typeof Model {
  const sequelizeClient: Sequelize = app.get('sequelizeClient');

  const conversations = sequelizeClient.define('conversations', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  }, {
    timestamps: true,
    hooks: {
      beforeCount(options: any) { options.raw = true; },
    },
  });

  (conversations as any).associate = function (models: any): void {
    conversations.hasMany(models.messages, { foreignKey: 'conversationId' });
    conversations.hasMany(models.conversation_participants, {
      foreignKey: 'conversationId',
      as: 'participants',
    });
  };

  return conversations;
}
