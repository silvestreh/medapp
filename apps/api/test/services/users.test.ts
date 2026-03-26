import assert from 'assert';
import app from '../../src/app';
import { User, ServiceMethods } from '../../src/declarations';

describe('\'users\' service', () => {
  let service: ServiceMethods<User>;
  let user: User;

  beforeEach(async () => {
    service = app.service('users');
  });

  it('registered the service', () => {
    assert.ok(app.service('users'), 'Registered the service');
  });

  describe('create-contact-data hook', () => {
    it('creates contact data and association when contactData is provided', async () => {
      const userData: Partial<User> = {
        username: 'test5',
        password: 'Password123!',
        contactData: {
          streetAddress: '123 Test St',
          city: 'Test City',
          province: 'Test Province',
          country: 'AR',
          phoneNumber: ['tel:1234567890'],
          email: 'test@example.com'
        }
      };

      try {
        user = await app.service('users').create(userData);
      } catch (error) {
        console.error('Validation error details:', error);
        throw error;
      }

      // Verify contact data was created
      const userContactData = await app.service('user-contact-data').find({
        query: {
          ownerId: user.id
        },
      });

      assert.equal(userContactData.total, 1);

      const contactData = await app.service('contact-data').get(userContactData.data[0].contactDataId);
      assert.equal(contactData.streetAddress, userData?.contactData?.streetAddress);
      assert.equal(contactData.email, userData?.contactData?.email);
    });

    it('skips contact data creation when contactData is not provided', async () => {
      const userData = {
        username: 'test2',
        password: 'Password123!',
      };

      user = await service.create(userData);

      const userContactData = await app.service('user-contact-data').find({
        query: {
          ownerId: user.id
        }
      });

      assert.equal(userContactData.total, 0);
    });
  });

  describe('generate-username hook', () => {
    it('infers username from email when no username provided', async () => {
      const userData = {
        email: 'generate.test@example.com',
        password: 'Password123!',
      };

      user = await app.service('users').create(userData as any);

      assert.equal(user.username, 'generate.test');

      const ucd = await app.service('user-contact-data').find({
        query: { ownerId: user.id },
      });
      assert.equal(ucd.total, 1);

      const cd = await app.service('contact-data').get(ucd.data[0].contactDataId);
      assert.equal(cd.email, 'generate.test@example.com');
    });

    it('appends readable suffix when username prefix is taken', async () => {
      const first = await app.service('users').create({
        email: 'duplicate.prefix@one.com',
        password: 'Password123!',
      } as any);

      assert.equal(first.username, 'duplicate.prefix');

      const second = await app.service('users').create({
        email: 'duplicate.prefix@two.com',
        password: 'Password123!',
      } as any);

      assert.ok(second.username.startsWith('duplicate.prefix-'), `Expected suffix, got: ${second.username}`);
      assert.notEqual(second.username, 'duplicate.prefix');
    });

    it('keeps explicit username when both username and email are provided', async () => {
      const userData = {
        username: 'explicit-user',
        email: 'explicit@example.com',
        password: 'Password123!',
      };

      user = await app.service('users').create(userData as any);

      assert.equal(user.username, 'explicit-user');
    });

    it('rejects invalid email format', async () => {
      try {
        await app.service('users').create({
          email: 'not-an-email',
          password: 'Password123!',
        } as any);
        assert.fail('Should have thrown');
      } catch (error: any) {
        assert.equal(error.code, 400);
        assert.ok(error.message.includes('Invalid email'));
      }
    });

    it('rejects signup with already-used email', async () => {
      await app.service('users').create({
        email: 'taken@example.com',
        password: 'Password123!',
      } as any);

      try {
        await app.service('users').create({
          email: 'taken@example.com',
          password: 'Password123!',
        } as any);
        assert.fail('Should have thrown');
      } catch (error: any) {
        assert.equal(error.code, 400);
        assert.ok(error.message.includes('already exists'));
      }
    });
  });

  describe('handle-personal-data hook', () => {
    it('creates personal data and association when personalData is provided', async () => {
      const userData = {
        username: 'test3',
        password: 'Password123!',
        personalData: {
          firstName: 'Test',
          lastName: 'User',
          dateOfBirth: '1990-01-01',
          gender: 'other',
          documentValue: '123456789'
        }
      };

      user = await service.create(userData);

      // Verify personal data was created
      const userPersonalData = await app.service('user-personal-data').find({
        query: {
          ownerId: user.id
        }
      });

      assert.equal(userPersonalData.total, 1);

      const personalData = await app.service('personal-data').get(userPersonalData.data[0].personalDataId);
      assert.equal(personalData.firstName, userData.personalData.firstName);
      assert.equal(personalData.lastName, userData.personalData.lastName);
    });

    it('skips personal data creation when personalData is not provided', async () => {
      const userData = {
        username: 'test4',
        password: 'Password123!',
      };

      user = await service.create(userData);

      const userPersonalData = await app.service('user-personal-data').find({
        query: {
          ownerId: user.id
        }
      });

      assert.equal(userPersonalData.total, 0);
    });
  });
});
