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
        password: 'password123',
        roleId: 'receptionist',
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
        password: 'password123',
        roleId: 'receptionist'
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

  describe('handle-personal-data hook', () => {
    it('creates personal data and association when personalData is provided', async () => {
      const userData = {
        username: 'test3',
        password: 'password123',
        roleId: 'receptionist',
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
        password: 'password123',
        roleId: 'receptionist'
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
