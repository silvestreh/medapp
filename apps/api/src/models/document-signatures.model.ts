import { Sequelize, DataTypes, Model } from 'sequelize';
import { Application } from '../declarations';

export default function (app: Application): typeof Model {
  const sequelizeClient: Sequelize = app.get('sequelizeClient');
  const documentSignatures = sequelizeClient.define('document_signatures', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    hash: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    signedById: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'users',
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
    organizationId: {
      type: DataTypes.STRING,
      allowNull: true,
      references: {
        model: 'organizations',
        key: 'id',
      },
    },
    signerName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    signedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    fileName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    content: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    studyId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  }, {
    updatedAt: false,
    indexes: [
      { fields: ['signedById'] },
      { fields: ['patientId'] },
      { fields: ['hash'] },
      { fields: ['createdAt'] },
    ],
  });

  (documentSignatures as any).associate = function (models: any): void {
    const { users, patients, organizations } = models;
    documentSignatures.belongsTo(users, { foreignKey: 'signedById' });
    documentSignatures.belongsTo(patients, { foreignKey: 'patientId' });
    documentSignatures.belongsTo(organizations, { foreignKey: 'organizationId' });
  };

  return documentSignatures;
}
