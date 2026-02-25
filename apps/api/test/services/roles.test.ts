import assert from 'assert';
import app from '../../src/app';
import client from '../test-client';

describe('\'roles\' service', () => {
  let medicUser: any;
  let receptionistUser: any;
  let patient: any;
  let encounter: any;
  let server: any;

  before(async () => {
    server = await app.listen(app.get('port'));

    medicUser = await app.service('users').create({
      username: 'test.medic',
      password: 'SuperSecret1',
      roleId: 'medic'
    });
    await app.service('md-settings').create({
      userId: medicUser.id,
      encounterDuration: 20,
      isVerified: true,
    });

    receptionistUser = await app.service('users').create({
      username: 'test.receptionist',
      password: 'SuperSecret1',
      roleId: 'receptionist'
    });

    patient = await app.service('patients').create({
      medicare: 'TEST123',
      medicareNumber: '12345'
    });

    // Create a new role with limited permissions
    await app.service('roles').create({
      id: 'limited-patch',
      permissions: [
        'patients:patch.medicareNumber'
      ]
    });

    // Create a user with the new role
    await app.service('users').create({
      username: 'limited.user',
      password: 'SuperSecret1',
      roleId: 'limited-patch'
    });
  });

  after(async () => {
    await server.close();
  });

  it('registered the service', () => {
    const service = app.service('roles');
    assert.ok(service, 'Registered the service');
  });

  describe('permissions tests', () => {
    it('allows medic to create and read encounters', async () => {
      await client.logout();
      await client.authenticate({
        strategy: 'local',
        username: medicUser.username,
        password: 'SuperSecret1'
      });

      encounter = await client.service('encounters').create({
        patientId: patient.id,
        medicId: medicUser.id,
        date: new Date(),
        data: { clinicalNotes: { values: { notes: 'Test encounter' } } }
      });

      assert.ok(encounter.id, 'Created an encounter');

      const fetchedEncounter = await client.service('encounters').get(encounter.id);

      assert.strictEqual(fetchedEncounter.id, encounter.id, 'Medic can read encounter');
    });

    it('prevents receptionist from creating or reading encounters', async () => {
      await client.logout();
      await client.authenticate({
        strategy: 'local',
        username: receptionistUser.username,
        password: 'SuperSecret1'
      });

      try {
        await client.service('encounters').create({
          patientId: patient.id,
          medicId: receptionistUser.id,
          date: new Date(),
          data: { clinicalNotes: { values: { notes: 'Test encounter' } } }
        });
        assert.fail('Should not allow receptionist to create encounter');
      } catch (error: any) {
        assert.ok(error.name === 'Forbidden', 'Throws Forbidden error when receptionist tries to create');
      }

      try {
        await client.service('encounters').get(encounter.id);
        assert.fail('Should not allow receptionist to read encounter');
      } catch (error: any) {
        assert.ok(error.name === 'Forbidden', 'Throws Forbidden error when receptionist tries to read');
      }
    });

    it('enforces ownership for medics', async () => {
      await client.logout();

      const anotherMedic = await app.service('users').create({
        username: 'another.medic',
        password: 'SuperSecret1',
        roleId: 'medic'
      });
      await app.service('md-settings').create({
        userId: anotherMedic.id,
        encounterDuration: 20,
        isVerified: true,
      });

      await client.authenticate({
        strategy: 'local',
        username: anotherMedic.username,
        password: 'SuperSecret1'
      });

      // Try to read encounter created by first medic
      try {
        await client.service('encounters').get(encounter.id);
        assert.fail('Should not allow other medic to read encounter');
      } catch (error: any) {
        assert.ok(error.name === 'Forbidden', 'Throws Forbidden error when other medic tries to read');
      }
    });

    it('allows limited user to patch only medicareNumber', async () => {
      await client.logout();
      await client.authenticate({
        strategy: 'local',
        username: 'limited.user',
        password: 'SuperSecret1'
      });

      await client.service('patients').patch(patient.id, {
        medicareNumber: '67890'
      });

      await client.logout();
      await client.authenticate({
        strategy: 'local',
        username: medicUser.username,
        password: 'SuperSecret1'
      });

      const updatedPatient = await client.service('patients').get(patient.id);

      assert.strictEqual(updatedPatient.medicareNumber, '67890', 'Updated medicareNumber');

      await client.logout();
      await client.authenticate({
        strategy: 'local',
        username: 'limited.user',
        password: 'SuperSecret1'
      });

      await client.service('patients').patch(patient.id, {
        medicare: 'NEWTEST123'
      });

      await client.logout();
      await client.authenticate({
        strategy: 'local',
        username: medicUser.username,
        password: 'SuperSecret1'
      });

      const ignoredUpdate = await client.service('patients').get(patient.id);

      assert.strictEqual(ignoredUpdate.medicare, 'TEST123', 'Medicare field should remain unchanged');
    });
  });
});
