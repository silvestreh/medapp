import { Sequelize, DataTypes, Model } from 'sequelize';
import { Application } from '../declarations';
import { HookReturn } from 'sequelize/types/hooks';

export default function (app: Application): typeof Model {
  const sequelizeClient: Sequelize = app.get('sequelizeClient');
  const formTemplates = sequelizeClient.define('form_templates', {
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
    type: {
      type: DataTypes.ENUM('encounter', 'study'),
      allowNull: false
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    label: {
      type: DataTypes.STRING,
      allowNull: false
    },
    formKey: {
      type: DataTypes.STRING,
      allowNull: false
    },
    schema: {
      type: DataTypes.JSONB,
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('draft', 'published', 'archived'),
      allowNull: false,
      defaultValue: 'draft'
    },
    currentVersionId: {
      type: DataTypes.STRING,
      allowNull: true,
      references: {
        model: 'form_template_versions',
        key: 'id'
      }
    },
    createdBy: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    }
  }, {
    indexes: [
      {
        name: 'form_templates_org_form_key',
        unique: true,
        fields: ['organizationId', 'formKey']
      },
      {
        name: 'form_templates_organization',
        fields: ['organizationId']
      }
    ],
    hooks: {
      beforeCount(options: any): HookReturn {
        options.raw = true;
      }
    }
  });

  (formTemplates as any).associate = function (models: any): void {
    const { organizations, users, form_template_versions } = models;
    formTemplates.belongsTo(organizations, { foreignKey: 'organizationId' });
    formTemplates.belongsTo(users, { foreignKey: 'createdBy', as: 'creator' });
    formTemplates.hasMany(form_template_versions, { foreignKey: 'formTemplateId', as: 'versions' });
    formTemplates.belongsTo(form_template_versions, { foreignKey: 'currentVersionId', as: 'currentVersion' });
  };

  return formTemplates;
}
