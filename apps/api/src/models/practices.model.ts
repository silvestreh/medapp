import { Sequelize, DataTypes, Model, Op } from 'sequelize';
import { Application } from '../declarations';
import { HookReturn } from 'sequelize/types/hooks';

export default function (app: Application): typeof Model {
  const sequelizeClient: Sequelize = app.get('sequelizeClient');
  const practices = sequelizeClient.define('practices', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    organizationId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'organizations',
        key: 'id'
      }
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    isSystem: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    systemKey: {
      type: DataTypes.STRING,
      allowNull: true
    }
  }, {
    indexes: [
      {
        name: 'practices_org_system_key',
        unique: true,
        fields: ['organizationId', 'systemKey'],
        where: { systemKey: { [Op.ne]: null } }
      },
      {
        name: 'practices_organization',
        fields: ['organizationId']
      }
    ],
    hooks: {
      beforeCount(options: any): HookReturn {
        options.raw = true;
      }
    }
  });

  (practices as any).associate = function (models: any): void {
    const { organizations } = models;
    practices.belongsTo(organizations, { foreignKey: 'organizationId' });
  };

  return practices;
}
