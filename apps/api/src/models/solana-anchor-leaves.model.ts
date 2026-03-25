import { Sequelize, DataTypes, Model } from 'sequelize';
import { Application } from '../declarations';

export default function (app: Application): typeof Model {
  const sequelizeClient: Sequelize = app.get('sequelizeClient');
  const solanaAnchorLeaves = sequelizeClient.define('solana_anchor_leaves', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    anchorId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'solana_anchors',
        key: 'id',
      },
    },
    recordId: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'encounter.id or access_log.id',
    },
    recordHash: {
      type: DataTypes.STRING(64),
      allowNull: false,
      comment: 'SHA-256 hash used as Merkle leaf',
    },
    leafIndex: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Position in the Merkle tree (0-based)',
    },
  }, {
    updatedAt: false,
    indexes: [
      { fields: ['anchorId'] },
      { fields: ['recordId'] },
      { fields: ['anchorId', 'leafIndex'], unique: true },
    ],
  });

  (solanaAnchorLeaves as any).associate = function (models: any): void {
    solanaAnchorLeaves.belongsTo(models.solana_anchors, { foreignKey: 'anchorId' });
  };

  return solanaAnchorLeaves;
}
