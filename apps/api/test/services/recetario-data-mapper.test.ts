import assert from 'assert';
import { mapDoctorForAPI, mapPatientForAPI, flattenAndSortMedications } from '../../src/services/recetario/data-mapper';

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

  describe('flattenAndSortMedications', () => {
    const med = (id: number, brand: string, drug: string, packages?: any) => ({
      id,
      brand,
      drug,
      requiresDuplicate: false,
      hivSpecific: false,
      packages,
    });

    it('sorts results alphabetically by brand', () => {
      const result = flattenAndSortMedications([
        med(1, 'Zolpidem MK', 'zolpidem'),
        med(2, 'Actron', 'ibuprofeno'),
        med(3, 'Ibupirac', 'ibuprofeno'),
      ]);

      assert.deepStrictEqual(
        result.map((m) => m.brand),
        ['Actron', 'Ibupirac', 'Zolpidem MK']
      );
    });

    it('sorts ignoring case and accents', () => {
      const result = flattenAndSortMedications([
        med(1, 'ácido fólico', 'ácido fólico'),
        med(2, 'Amoxidal', 'amoxicilina'),
        med(3, 'ABRILAR', 'hedera helix'),
      ]);

      assert.deepStrictEqual(
        result.map((m) => m.brand),
        ['ABRILAR', 'ácido fólico', 'Amoxidal']
      );
    });

    it('flattens package arrays into one entry per package and sorts ties by package name', () => {
      const result = flattenAndSortMedications([
        med(1, 'Actron', 'ibuprofeno', [
          { id: 11, name: 'comp. x 20', externalId: 'ext-20' },
          { id: 10, name: 'comp. x 10', externalId: 'ext-10' },
        ]),
        med(2, 'Actron', 'ibuprofeno', { id: 12, name: 'cáps. x 30', externalId: 'ext-30' }),
      ]);

      assert.strictEqual(result.length, 3);
      assert.deepStrictEqual(
        result.map((m) => m.packages?.externalId),
        ['ext-30', 'ext-10', 'ext-20']
      );
    });

    it('keeps entries without packages, normalizing packages to undefined', () => {
      const result = flattenAndSortMedications([med(1, 'Actron', 'ibuprofeno', [])]);

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].packages, undefined);
    });
  });
});
