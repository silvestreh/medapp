import { Sequelize, DataTypes, Model } from 'sequelize';
import { Application } from '../declarations';

export default function (app: Application): typeof Model {
  const sequelizeClient: Sequelize = app.get('sequelizeClient');

  const conversationParticipants = sequelizeClient.define('conversation_participants', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    conversationId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    userId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    lastReadAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    timestamps: true,
    hooks: {
      beforeCount(options: any) { options.raw = true; },
    },
  });

  (conversationParticipants as any).associate = function (models: any): void {
    conversationParticipants.belongsTo(models.conversations, {
      foreignKey: 'conversationId',
    });
  };

  return conversationParticipants;
}
