import assert from 'assert';

import { anonymizeEncounterHistory } from '../../src/utils/anonymize-encounter-history';

describe('anonymizeEncounterHistory', () => {
  it('redacts patient identifiers and keeps clinical content', () => {
    const result = anonymizeEncounterHistory({
      patient: {
        id: 'patient-1',
        personalData: {
          firstName: 'John',
          lastName: 'Doe',
          documentValue: '12345678',
          birthDate: '1990-01-01',
          gender: 'male',
        },
        contactData: {
          email: 'john.doe@example.com',
          phoneNumber: ['+54 11 5555 1212'],
        },
      },
      encounters: [
        {
          date: '2024-01-01T10:00:00.000Z',
          data: {
            notes: 'John reports chest pain. Contact: john.doe@example.com',
            bloodPressure: '130/80',
            documentValue: '12345678',
          },
        },
      ],
      studies: [
        {
          id: 'study-1',
          date: '2024-01-02T08:00:00.000Z',
          protocol: 44,
          studies: ['ecg'],
          referringDoctor: 'John Doe',
          results: [
            {
              type: 'ecg',
              data: {
                conclusion: 'Findings for John Doe',
                comments: 'Call at +54 11 5555 1212',
              },
            },
          ],
        },
      ],
    });

    assert.equal(result.patient.label, 'Patient_A');
    assert.equal(result.encounters.length, 1);
    assert.equal(result.encounters[0].relativeDay, 0);
    assert.equal(result.encounters[0].data.bloodPressure, '130/80');
    assert.equal(result.encounters[0].data.documentValue, '[REDACTED]');
    assert.ok(!String(result.encounters[0].data.notes).includes('john.doe@example.com'));
    assert.ok(!String(result.encounters[0].data.notes).includes('John'));
    assert.equal(result.studies.length, 1);
    assert.equal(result.studies[0].relativeDay, 1);
    assert.equal(result.studies[0].referringDoctor, '[REDACTED]');
    assert.ok(!String(result.studies[0].results[0].data.conclusion).includes('John'));
  });

  it('computes relative day offsets across encounters and studies', () => {
    const result = anonymizeEncounterHistory({
      patient: { id: 'patient-1' },
      encounters: [
        { date: '2024-01-03T00:00:00.000Z', data: { symptom: 'fever' } },
        { date: '2024-01-01T00:00:00.000Z', data: { symptom: 'cough' } },
      ],
      studies: [
        { date: '2024-01-02T00:00:00.000Z', results: [] },
      ],
    });

    assert.equal(result.encounters[0].relativeDay, 0);
    assert.equal(result.encounters[1].relativeDay, 2);
    assert.equal(result.studies[0].relativeDay, 1);
  });
});
