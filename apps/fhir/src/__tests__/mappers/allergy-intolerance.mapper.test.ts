import assert from 'assert';
import { mapDrugAllergies, mapGeneralAllergies } from '../../mappers/allergy-intolerance.mapper';

describe('AllergyIntolerance Mapper', () => {
  const context = {
    encounterId: 'enc-001',
    patientId: 'patient-001',
    medicId: 'medic-001',
  };

  describe('Drug Allergies', () => {
    it('should map drug allergies with confirmed status', () => {
      const entries = [{ drug: 'Penicilina', status: 'confirmado' }];
      const results = mapDrugAllergies(entries, context);

      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].resourceType, 'AllergyIntolerance');
      assert.deepStrictEqual(results[0].category, ['medication']);
      assert.strictEqual(results[0].code?.text, 'Penicilina');
      assert.strictEqual(results[0].verificationStatus?.coding?.[0].code, 'confirmed');
      assert.strictEqual(results[0].patient?.reference, 'Patient/patient-001');
    });

    it('should default to unconfirmed for unknown status', () => {
      const entries = [{ drug: 'Aspirina', status: 'sospechado' }];
      const results = mapDrugAllergies(entries, context);
      assert.strictEqual(results[0].verificationStatus?.coding?.[0].code, 'unconfirmed');
    });

    it('should map multiple drug allergies', () => {
      const entries = [
        { drug: 'Penicilina', status: 'confirmado' },
        { drug: 'Sulfa', status: 'sospechado' },
      ];
      const results = mapDrugAllergies(entries, context);
      assert.strictEqual(results.length, 2);
    });
  });

  describe('General Allergies', () => {
    it('should map general allergens with correct categories', () => {
      const allergens = {
        al_alimentos: 'Mariscos',
        al_acaros: 'Ácaros del polvo',
        al_polen_arboles: 'Platanus',
      };
      const results = mapGeneralAllergies(allergens, context);

      assert.strictEqual(results.length, 3);

      const food = results.find(r => r.code?.text?.includes('Alimentos'));
      assert.ok(food);
      assert.deepStrictEqual(food!.category, ['food']);

      const dust = results.find(r => r.code?.text?.includes('Ácaros'));
      assert.ok(dust);
      assert.deepStrictEqual(dust!.category, ['environment']);
    });

    it('should return empty array for no allergens', () => {
      const results = mapGeneralAllergies({}, context);
      assert.strictEqual(results.length, 0);
    });
  });
});
