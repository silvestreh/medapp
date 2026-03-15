import assert from 'assert';
import { parseEncounterData } from '../../utils/encounter-parser';

describe('Encounter Parser', () => {
  it('should parse conditions from antecedentes/personales', () => {
    const data = {
      'antecedentes/personales': {
        type: 'antecedentes/personales',
        values: {
          antecedente_count: '2',
          antecedente_0: 'I10',
          fecha_antecedente_0: '15/06/2023',
          antecedente_descripcion_0: 'Hipertensión',
          antecedente_1: 'E11',
          fecha_antecedente_1: '',
          antecedente_descripcion_1: '',
        },
      },
    };
    const parsed = parseEncounterData(data);
    assert.strictEqual(parsed.conditions.length, 2);
    assert.strictEqual(parsed.conditions[0].issueId, 'I10');
    assert.strictEqual(parsed.conditions[1].issueId, 'E11');
  });

  it('should parse drug allergies from alergias/medicamentos', () => {
    const data = {
      'alergias/medicamentos': {
        type: 'alergias/medicamentos',
        values: {
          al_m_count: '1',
          al_m_droga_0: 'Penicilina',
          al_m_estado_0: 'confirmado',
        },
      },
    };
    const parsed = parseEncounterData(data);
    assert.strictEqual(parsed.drugAllergies.length, 1);
    assert.strictEqual(parsed.drugAllergies[0].drug, 'Penicilina');
    assert.strictEqual(parsed.drugAllergies[0].status, 'confirmado');
  });

  it('should parse general allergies from alergias/general', () => {
    const data = {
      'alergias/general': {
        type: 'alergias/general',
        values: {
          al_alimentos: 'Mariscos',
          al_acaros: '',
          al_polen_arboles: 'Platanus',
        },
      },
    };
    const parsed = parseEncounterData(data);
    assert.strictEqual(Object.keys(parsed.generalAllergies).length, 2);
    assert.strictEqual(parsed.generalAllergies.al_alimentos, 'Mariscos');
    assert.strictEqual(parsed.generalAllergies.al_polen_arboles, 'Platanus');
  });

  it('should parse medication history from antecedentes/medicamentosos', () => {
    const data = {
      'antecedentes/medicamentosos': {
        type: 'antecedentes/medicamentosos',
        values: {
          ant_med_count: '1',
          droga_0: 'Enalapril',
          ant_fecha_0: '2023-01-15T00:00:00.000Z',
          efectivo_0: 'si',
          efecto_adverso_0: '',
          ant_comments_0: '',
        },
      },
    };
    const parsed = parseEncounterData(data);
    assert.strictEqual(parsed.medications.length, 1);
    assert.strictEqual(parsed.medications[0].droga, 'Enalapril');
  });

  it('should handle empty/null data', () => {
    const parsed = parseEncounterData(null);
    assert.strictEqual(parsed.conditions.length, 0);
    assert.strictEqual(parsed.drugAllergies.length, 0);
    assert.strictEqual(Object.keys(parsed.generalAllergies).length, 0);
    assert.strictEqual(parsed.medications.length, 0);
  });

  it('should handle JSON string data', () => {
    const data = JSON.stringify({
      'antecedentes/personales': {
        type: 'antecedentes/personales',
        values: {
          antecedente_count: '1',
          antecedente_0: 'J45',
          fecha_antecedente_0: '',
          antecedente_descripcion_0: 'Asma',
        },
      },
    });
    const parsed = parseEncounterData(data);
    assert.strictEqual(parsed.conditions.length, 1);
    assert.strictEqual(parsed.conditions[0].issueId, 'J45');
  });

  it('should filter out empty entries', () => {
    const data = {
      'antecedentes/personales': {
        type: 'antecedentes/personales',
        values: {
          antecedente_count: '2',
          antecedente_0: 'I10',
          fecha_antecedente_0: '',
          antecedente_descripcion_0: '',
          antecedente_1: '',
          fecha_antecedente_1: '',
          antecedente_descripcion_1: '',
        },
      },
      'alergias/medicamentos': {
        type: 'alergias/medicamentos',
        values: {
          al_m_count: '1',
          al_m_droga_0: '',
          al_m_estado_0: '',
        },
      },
    };
    const parsed = parseEncounterData(data);
    assert.strictEqual(parsed.conditions.length, 1);
    assert.strictEqual(parsed.drugAllergies.length, 0);
  });
});
