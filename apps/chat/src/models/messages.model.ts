import { Sequelize, DataTypes, Model } from 'sequelize';
import { Application } from '../declarations';

export default function (app: Application): typeof Model {
  const sequelizeClient: Sequelize = app.get('sequelizeClient');

  const messages = sequelizeClient.define('messages', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    conversationId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    senderId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM('text', 'system'),
      allowNull: false,
      defaultValue: 'text',
    },
    replyToId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
  }, {
    timestamps: true,
    hooks: {
      beforeCount(options: any) { options.raw = true; },
    },
  });

  (messages as any).associate = function (models: any): void {
    messages.belongsTo(models.conversations, { foreignKey: 'conversationId' });
    messages.belongsTo(models.messages, { as: 'replyTo', foreignKey: 'replyToId' });
  };

  return messages;
}
