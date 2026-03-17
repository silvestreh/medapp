import { Sequelize, DataTypes, Model } from 'sequelize';
import { Application } from '../declarations';
import { HookReturn } from 'sequelize/types/hooks';

export default function (app: Application): typeof Model {
  const sequelizeClient: Sequelize = app.get('sequelizeClient');
  const patientRefreshTokens = sequelizeClient.define('patient_refresh_tokens', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    patientId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'patients',
        key: 'id'
      }
    },
    organizationId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'organizations',
        key: 'id'
      }
    },
    tokenHash: {
      type: DataTypes.STRING(64),
      allowNull: false
    },
    family: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4
    },
    audience: {
      type: DataTypes.STRING,
      allowNull: false
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false
    },
    revokedAt: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    hooks: {
      beforeCount(options: any): HookReturn {
        options.raw = true;
      }
    }
  });

  (patientRefreshTokens as any).associate = function (models: any): void {
    const { patients, organizations } = models;
    patientRefreshTokens.belongsTo(patients, { foreignKey: 'patientId' });
    patientRefreshTokens.belongsTo(organizations, { foreignKey: 'organizationId' });
  };

  return patientRefreshTokens;
}
