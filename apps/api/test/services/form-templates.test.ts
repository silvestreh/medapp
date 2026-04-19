import assert from 'assert';
import app from '../../src/app';
import { createTestClient } from '../test-client';
import { createTestOrganization, createTestUser } from '../test-helpers';

const validSchema = {
  fieldsets: [
    {
      id: 'fs-1',
      title: 'General',
      fields: [
        { type: 'input', name: 'field1', label: 'Field 1' },
        { type: 'textarea', name: 'field2', label: 'Field 2' },
      ],
    },
  ],
};

describe('\'form-templates\' service', () => {
  let designerUser: any;
  let medicUser: any;
  let receptionistUser: any;
  let org: any;
  let client: any;
  let server: any;

  before(async () => {
    server = await app.listen(app.get('port'));
    org = await createTestOrganization();
    client = createTestClient(org.id as string);

    // Ensure roles exist with correct permissions
    await app
      .service('roles')
      .create({
        id: 'form-designer',
        permissions: [
          'form-templates:find',
          'form-templates:get',
          'form-templates:create:all',
          'form-templates:patch:all',
          'form-templates:remove:all',
          'form-template-versions:find',
          'form-template-versions:get',
        ],
      })
      .catch(() => null);

    await app
      .service('roles')
      .create({
        id: 'medic',
        permissions: [
          'form-templates:find',
          'form-templates:get',
          'form-template-versions:find',
          'form-template-versions:get',
        ],
      })
      .catch(() => null);

    await app
      .service('roles')
      .create({
        id: 'receptionist',
        permissions: [],
      })
      .catch(() => null);

    const suffix = Date.now().toString(36);

    designerUser = await createTestUser({
      username: `ft.designer.${suffix}`,
      password: 'SuperSecret1!',
      roleIds: ['form-designer'],
      organizationId: org.id,
    });

    medicUser = await createTestUser({
      username: `ft.medic.${suffix}`,
      password: 'SuperSecret1!',
      roleIds: ['medic'],
      organizationId: org.id,
    });

    receptionistUser = await createTestUser({
      username: `ft.receptionist.${suffix}`,
      password: 'SuperSecret1!',
      roleIds: ['receptionist'],
      organizationId: org.id,
    });
  });

  after(async () => {
    await server.close();
  });

  it('registered the service', () => {
    const service = app.service('form-templates');
    assert.ok(service, 'Registered the service');
  });

  it('registered the versions service', () => {
    const service = app.service('form-template-versions');
    assert.ok(service, 'Registered the versions service');
  });

  describe('CRUD operations', () => {
    let templateId: string;

    it('allows form-designer to create a form template', async () => {
      await client.logout();
      await client.authenticate({
        strategy: 'local',
        username: designerUser.username,
        password: 'SuperSecret1!',
      });

      const template = await client.service('form-templates').create({
        type: 'encounter',
        name: 'Test Form',
        label: 'Test Form Label',
        schema: validSchema,
      });

      assert.ok(template.id, 'Created template has an id');
      assert.strictEqual(template.type, 'encounter');
      assert.strictEqual(template.status, 'draft');
      assert.ok(
        template.formKey.startsWith('custom/'),
        'Form key has custom/ prefix'
      );
      assert.strictEqual(template.createdBy, designerUser.id);
      assert.strictEqual(template.organizationId, org.id);
      templateId = template.id;
    });

    it('allows form-designer to find form templates', async () => {
      const result = await client.service('form-templates').find();
      assert.ok(result.data.length > 0, 'Found templates');
    });

    it('allows form-designer to get a form template', async () => {
      const template = await client.service('form-templates').get(templateId);
      assert.strictEqual(template.id, templateId);
    });

    it('allows form-designer to patch a form template', async () => {
      const template = await client.service('form-templates').patch(templateId, {
        label: 'Updated Label',
      });
      assert.strictEqual(template.label, 'Updated Label');
    });

    it('allows form-designer to remove a form template', async () => {
      const removed = await client.service('form-templates').remove(templateId);
      assert.strictEqual(removed.id, templateId);
    });
  });

  describe('permissions', () => {
    it('allows medic to find form templates (read-only)', async () => {
      await client.logout();

      // Create a template internally for the medic to find
      const template = await app.service('form-templates').create({
        type: 'encounter',
        name: 'Medic Visible Form',
        label: 'Medic Visible Form',
        formKey: 'custom/medic-visible',
        schema: validSchema,
        organizationId: org.id,
        createdBy: designerUser.id,
        status: 'published',
      }) as any;

      await client.authenticate({
        strategy: 'local',
        username: medicUser.username,
        password: 'SuperSecret1!',
      });

      const result = await client.service('form-templates').find();
      assert.ok(result.data.length > 0, 'Medic can find templates');

      // Clean up
      await app.service('form-templates').remove(template.id);
    });

    it('prevents medic from creating form templates', async () => {
      await client.logout();
      await client.authenticate({
        strategy: 'local',
        username: medicUser.username,
        password: 'SuperSecret1!',
      });

      try {
        await client.service('form-templates').create({
          type: 'encounter',
          name: 'Should Fail',
          label: 'Should Fail',
          schema: validSchema,
        });
        assert.fail('Should not allow medic to create');
      } catch (error: any) {
        assert.strictEqual(error.name, 'Forbidden');
      }
    });

    it('prevents receptionist from accessing form templates', async () => {
      await client.logout();
      await client.authenticate({
        strategy: 'local',
        username: receptionistUser.username,
        password: 'SuperSecret1!',
      });

      try {
        await client.service('form-templates').find();
        assert.fail('Should not allow receptionist to find');
      } catch (error: any) {
        assert.strictEqual(error.name, 'Forbidden');
      }
    });
  });

  describe('schema validation', () => {
    before(async () => {
      await client.logout();
      await client.authenticate({
        strategy: 'local',
        username: designerUser.username,
        password: 'SuperSecret1!',
      });
    });

    it('rejects schemas without fieldsets', async () => {
      try {
        await client.service('form-templates').create({
          type: 'encounter',
          name: 'Invalid Schema',
          label: 'Invalid Schema',
          schema: { fields: [] },
        });
        assert.fail('Should reject schema without fieldsets');
      } catch (error: any) {
        assert.strictEqual(error.name, 'BadRequest');
      }
    });

    it('rejects schemas with invalid field types', async () => {
      try {
        await client.service('form-templates').create({
          type: 'encounter',
          name: 'Invalid Field Type',
          label: 'Invalid Field Type',
          schema: {
            fieldsets: [
              {
                id: 'fs-1',
                fields: [{ type: 'nonexistent', name: 'bad', label: 'Bad' }],
              },
            ],
          },
        });
        assert.fail('Should reject invalid field type');
      } catch (error: any) {
        assert.strictEqual(error.name, 'BadRequest');
      }
    });

    it('rejects schemas with duplicate field names', async () => {
      try {
        await client.service('form-templates').create({
          type: 'encounter',
          name: 'Duplicate Names',
          label: 'Duplicate Names',
          schema: {
            fieldsets: [
              {
                id: 'fs-1',
                fields: [
                  { type: 'input', name: 'duplicate', label: 'First' },
                  { type: 'input', name: 'duplicate', label: 'Second' },
                ],
              },
            ],
          },
        });
        assert.fail('Should reject duplicate field names');
      } catch (error: any) {
        assert.strictEqual(error.name, 'BadRequest');
      }
    });

    it('rejects study schemas with encounter-only field types', async () => {
      try {
        await client.service('form-templates').create({
          type: 'study',
          name: 'Study Bad Type',
          label: 'Study Bad Type',
          schema: {
            fieldsets: [
              {
                id: 'fs-1',
                fields: [{ type: 'icd10', name: 'diag', label: 'Diagnosis' }],
              },
            ],
          },
        });
        assert.fail('Should reject icd10 in study form');
      } catch (error: any) {
        assert.strictEqual(error.name, 'BadRequest');
      }
    });
  });

  describe('publish workflow', () => {
    let templateId: string;

    before(async () => {
      await client.logout();
      await client.authenticate({
        strategy: 'local',
        username: designerUser.username,
        password: 'SuperSecret1!',
      });

      const template = await client.service('form-templates').create({
        type: 'encounter',
        name: 'Publish Test',
        label: 'Publish Test',
        schema: validSchema,
      });
      templateId = template.id;
    });

    it('creates a version snapshot when publishing', async () => {
      const published = await client
        .service('form-templates')
        .patch(templateId, { status: 'published' });

      assert.strictEqual(published.status, 'published');
      assert.ok(published.currentVersionId, 'Has a currentVersionId after publish');

      // Fetch the version
      const version = await app
        .service('form-template-versions')
        .get(published.currentVersionId);
      assert.ok(version, 'Version record exists');
      assert.strictEqual(version.formTemplateId, templateId);
      assert.strictEqual(version.version, 1);
      assert.deepStrictEqual(version.schema, validSchema);
    });

    it('creates a new version on re-publish after edits', async () => {
      const updatedSchema = {
        fieldsets: [
          {
            id: 'fs-1',
            title: 'Updated',
            fields: [
              { type: 'input', name: 'field1', label: 'Updated Field 1' },
              { type: 'textarea', name: 'field2', label: 'Field 2' },
              { type: 'select', name: 'field3', label: 'New Select', options: [{ value: 'a', label: 'A' }] },
            ],
          },
        ],
      };

      // First move back to draft to edit
      await client
        .service('form-templates')
        .patch(templateId, { status: 'draft', schema: updatedSchema });

      // Then publish again
      const republished = await client
        .service('form-templates')
        .patch(templateId, { status: 'published' });

      const version = await app
        .service('form-template-versions')
        .get(republished.currentVersionId);

      assert.strictEqual(version.version, 2);
      assert.deepStrictEqual(version.schema, updatedSchema);
    });

    it('preserves old version records', async () => {
      const versions = await app.service('form-template-versions').find({
        query: { formTemplateId: templateId, $sort: { version: 1 } },
        paginate: false,
      });

      assert.strictEqual((versions as any[]).length, 2, 'Both versions exist');
      assert.strictEqual((versions as any[])[0].version, 1);
      assert.strictEqual((versions as any[])[1].version, 2);
    });
  });

  describe('form key generation', () => {
    it('auto-generates a form key from the name', async () => {
      await client.logout();
      await client.authenticate({
        strategy: 'local',
        username: designerUser.username,
        password: 'SuperSecret1!',
      });

      const template = await client.service('form-templates').create({
        type: 'encounter',
        name: 'Hematología Básica',
        label: 'Hematología Básica',
        schema: validSchema,
      });

      assert.ok(template.formKey.startsWith('custom/'));
      assert.ok(
        template.formKey.includes('hematologia-basica'),
        `Expected formKey to include slug, got: ${template.formKey}`
      );

      await client.service('form-templates').remove(template.id);
    });

    it('handles duplicate names by appending a counter', async () => {
      const template1 = await client.service('form-templates').create({
        type: 'encounter',
        name: 'Duplicate Name Test',
        label: 'Duplicate Name Test',
        schema: validSchema,
      });

      const template2 = await client.service('form-templates').create({
        type: 'encounter',
        name: 'Duplicate Name Test',
        label: 'Duplicate Name Test 2',
        schema: validSchema,
      });

      assert.notStrictEqual(
        template1.formKey,
        template2.formKey,
        'Form keys should be different'
      );

      await client.service('form-templates').remove(template1.id);
      await client.service('form-templates').remove(template2.id);
    });
  });

  describe('organization scoping', () => {
    it('scopes templates to the requesting organization', async () => {
      const otherOrg = await createTestOrganization({ name: 'Other Org' });
      const otherClient = createTestClient(otherOrg.id as string);

      const otherDesigner = await createTestUser({
        username: `ft.other.designer.${Date.now().toString(36)}`,
        password: 'SuperSecret1!',
        roleIds: ['form-designer'],
        organizationId: otherOrg.id,
      });

      await otherClient.authenticate({
        strategy: 'local',
        username: otherDesigner.username,
        password: 'SuperSecret1!',
      });

      // Create template in other org
      await otherClient.service('form-templates').create({
        type: 'encounter',
        name: 'Other Org Form',
        label: 'Other Org Form',
        schema: validSchema,
      });

      // Original org should not see it
      await client.logout();
      await client.authenticate({
        strategy: 'local',
        username: designerUser.username,
        password: 'SuperSecret1!',
      });

      const result = await client.service('form-templates').find();
      const otherOrgTemplates = result.data.filter(
        (t: any) => t.organizationId === otherOrg.id
      );
      assert.strictEqual(
        otherOrgTemplates.length,
        0,
        'Should not see other org templates'
      );

      await otherClient.logout();
    });
  });
});
