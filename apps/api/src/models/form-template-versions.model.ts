import { Sequelize, DataTypes, Model } from 'sequelize';
import { Application } from '../declarations';
import { HookReturn } from 'sequelize/types/hooks';

export default function (app: Application): typeof Model {
  const sequelizeClient: Sequelize = app.get('sequelizeClient');
  const formTemplateVersions = sequelizeClient.define('form_template_versions', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    formTemplateId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'form_templates',
        key: 'id'
      }
    },
    version: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    schema: {
      type: DataTypes.JSONB,
      allowNull: false
    }
  }, {
    indexes: [
      {
        name: 'form_template_versions_template',
        fields: ['formTemplateId']
      },
      {
        name: 'form_template_versions_template_version',
        unique: true,
        fields: ['formTemplateId', 'version']
      }
    ],
    hooks: {
      beforeCount(options: any): HookReturn {
        options.raw = true;
      }
    }
  });

  (formTemplateVersions as any).associate = function (models: any): void {
    const { form_templates } = models;
    formTemplateVersions.belongsTo(form_templates, { foreignKey: 'formTemplateId' });
  };

  return formTemplateVersions;
}
