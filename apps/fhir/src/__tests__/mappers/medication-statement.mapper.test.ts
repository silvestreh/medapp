import assert from 'assert';
import { mapMedicationHistory, mapPrescriptionMedications } from '../../mappers/medication-statement.mapper';

describe('MedicationStatement Mapper', () => {
  const context = {
    patientId: 'patient-001',
    medicId: 'medic-001',
    encounterId: 'enc-001',
  };

  describe('Medication History (from encounters)', () => {
    it('should map active medication', () => {
      const items = [{
        droga: 'Enalapril 10mg',
        ant_fecha: new Date('2023-01-15'),
        efectivo: true as const,
        efecto_adverso: '',
        ant_comments: 'Dosis diaria',
      }];
      const results = mapMedicationHistory(items, context);

      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].resourceType, 'MedicationStatement');
      assert.strictEqual(results[0].status, 'active');
      assert.strictEqual(results[0].medicationCodeableConcept?.text, 'Enalapril 10mg');
      assert.strictEqual(results[0].effectiveDateTime, '2023-01-15');
      assert.strictEqual(results[0].subject?.reference, 'Patient/patient-001');
    });

    it('should map stopped medication', () => {
      const items = [{
        droga: 'Metformina',
        ant_fecha: null,
        efectivo: false as const,
        efecto_adverso: 'Náuseas',
        ant_comments: '',
      }];
      const results = mapMedicationHistory(items, context);

      assert.strictEqual(results[0].status, 'stopped');
      assert.ok(results[0].note?.[0].text?.includes('Náuseas'));
    });

    it('should map unknown effectiveness to unknown status', () => {
      const items = [{
        droga: 'Ibuprofeno',
        ant_fecha: null,
        efectivo: 'indeterminate' as const,
        efecto_adverso: '',
        ant_comments: '',
      }];
      const results = mapMedicationHistory(items, context);
      assert.strictEqual(results[0].status, 'unknown');
    });
  });

  describe('Prescription Medications', () => {
    it('should map prescription medicines', () => {
      const prescriptions = [{
        id: 'rx-001',
        content: {
          diagnosis: 'Hipertensión',
          medicines: [
            { text: 'Losartán 50mg', posology: '1 comprimido cada 12hs' },
            { text: 'Aspirina 100mg', posology: '1 comprimido/día' },
          ],
        },
        status: 'completed',
      }];
      const results = mapPrescriptionMedications(prescriptions, context);

      assert.strictEqual(results.length, 2);
      assert.strictEqual(results[0].status, 'completed');
      assert.strictEqual(results[0].medicationCodeableConcept?.text, 'Losartán 50mg');
      assert.strictEqual(results[0].dosage?.[0].text, '1 comprimido cada 12hs');
    });

    it('should skip empty medicine entries', () => {
      const prescriptions = [{
        id: 'rx-002',
        content: {
          medicines: [
            { text: '', posology: '' },
            { text: 'Omeprazol', posology: '' },
          ],
        },
        status: 'pending',
      }];
      const results = mapPrescriptionMedications(prescriptions, context);
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].medicationCodeableConcept?.text, 'Omeprazol');
    });

    it('should map cancelled prescription as stopped', () => {
      const prescriptions = [{
        id: 'rx-003',
        content: { medicines: [{ text: 'Amoxicilina 500mg' }] },
        status: 'cancelled',
      }];
      const results = mapPrescriptionMedications(prescriptions, context);
      assert.strictEqual(results[0].status, 'stopped');
    });
  });
});
