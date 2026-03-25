import { Sequelize, DataTypes, Model } from 'sequelize';
import { Application } from '../declarations';

export default function (app: Application): typeof Model {
  const sequelizeClient: Sequelize = app.get('sequelizeClient');
  const solanaAnchors = sequelizeClient.define('solana_anchors', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    merkleRoot: {
      type: DataTypes.STRING(64),
      allowNull: false,
      comment: 'Hex-encoded SHA-256 Merkle root',
    },
    leafCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    chainType: {
      type: DataTypes.ENUM('encounters', 'access_logs'),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('pending', 'confirmed', 'failed'),
      allowNull: false,
      defaultValue: 'pending',
    },
    txSignature: {
      type: DataTypes.STRING(128),
      allowNull: true,
      comment: 'Solana transaction signature (base58)',
    },
    slot: {
      type: DataTypes.BIGINT,
      allowNull: true,
      comment: 'Solana slot number',
    },
    network: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    batchStartDate: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    batchEndDate: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    retryCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  }, {
    indexes: [
      { fields: ['status'] },
      { fields: ['chainType', 'createdAt'] },
      { fields: ['txSignature'], unique: true },
    ],
  });

  return solanaAnchors;
}
