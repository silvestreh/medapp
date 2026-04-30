import assert from 'assert';
import { mapDoctorForAPI, mapPatientForAPI } from '../../src/services/recetario/data-mapper';

describe('recetario data-mapper', () => {
  describe('mapPatientForAPI', () => {
    it('does not throw when phoneNumber is a number', () => {
      const patient = {
        personalData: {
          firstName: 'Ana',
          lastName: 'Garcia',
          documentType: 'DNI',
          documentValue: '12345678',
          gender: 'female',
          birthDate: '1990-01-15',
        },
        contactData: {
          email: 'ana@example.com',
          phoneNumber: 5491112345678 as unknown as string,
        },
        insurerName: 'particular',
      };

      const payload = mapPatientForAPI(patient);

      assert.strictEqual(typeof payload.phone, 'string');
      assert.strictEqual(payload.phone, '5491112345678');
    });

    it('strips a "tel:" prefix from a string phoneNumber', () => {
      const patient = {
        personalData: { firstName: 'A', lastName: 'B', documentValue: '1' },
        contactData: { phoneNumber: 'tel:+5491112345678' },
      };

      const payload = mapPatientForAPI(patient);

      assert.strictEqual(payload.phone, '+5491112345678');
    });

    it('returns undefined phone when phoneNumber is null', () => {
      const patient = {
        personalData: { firstName: 'A', lastName: 'B', documentValue: '1' },
        contactData: { phoneNumber: null },
      };

      const payload = mapPatientForAPI(patient);

      assert.strictEqual(payload.phone, undefined);
    });

    it('coerces a numeric medicareNumber to a string', () => {
      const patient = {
        personalData: { firstName: 'A', lastName: 'B', documentValue: '1' },
        contactData: {},
        insurerName: 'OSDE',
        medicareNumber: 987654321 as unknown as string,
      };

      const payload = mapPatientForAPI(patient);

      assert.strictEqual(payload.insuranceNumber, '987654321');
    });
  });

  describe('mapDoctorForAPI', () => {
    it('does not throw when phoneNumber is a number', () => {
      const doctor = {
        personalData: { firstName: 'Dr', lastName: 'House', documentValue: '1' },
        contactData: {
          email: 'house@example.com',
          phoneNumber: 5491112345678 as unknown as string,
        },
        mdSettings: {
          medicalSpecialty: 'Cardiología',
          nationalLicenseNumber: 'MN12345',
          recetarioTitle: 'Dr',
          recetarioProvince: 'AR-C',
        },
      };

      const payload = mapDoctorForAPI(doctor);

      assert.strictEqual(typeof payload.profile.phone, 'string');
      assert.strictEqual(payload.profile.phone, '5491112345678');
    });
  });
});
