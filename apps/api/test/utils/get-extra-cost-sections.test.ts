import assert from 'assert';
import { getExtraCostSections, studySchemas, type StudySchema } from '@medapp/encounter-schemas';

describe('getExtraCostSections', () => {
  it('returns sections with addsExtraCost from hemostasis schema', () => {
    const sections = getExtraCostSections(studySchemas.hemostasis);

    assert.strictEqual(sections.length, 1);
    assert.strictEqual(sections[0].name, 'regular_blood_plasma_correction');
    assert.strictEqual(sections[0].label, 'Corrección con plasma normal');
    assert.ok(sections[0].fieldNames.length > 0, 'Should have field names');
    assert.ok(
      sections[0].fieldNames.includes('regular_blood_plasma_correction_quick'),
      'Should include correction quick field'
    );
    assert.ok(
      sections[0].fieldNames.includes('regular_blood_plasma_correction_aptt'),
      'Should include correction aptt field'
    );
  });

  it('returns empty array for schemas without addsExtraCost', () => {
    const anemiaResult = getExtraCostSections(studySchemas.anemia);
    assert.strictEqual(anemiaResult.length, 0);

    const anticoagResult = getExtraCostSections(studySchemas.anticoagulation);
    assert.strictEqual(anticoagResult.length, 0);
  });

  it('collects fields between the flagged title and the next title', () => {
    const schema: StudySchema = {
      name: 'test',
      label: 'Test',
      fields: [
        { name: 'normal_field', label: 'Normal', type: 'input' },
        { name: 'section_a', label: 'Section A', type: 'title', addsExtraCost: true },
        { name: 'a_field_1', label: 'A1', type: 'input' },
        { name: 'a_field_2', label: 'A2', type: 'input' },
        { name: 'section_b', label: 'Section B', type: 'title' },
        { name: 'b_field_1', label: 'B1', type: 'input' },
      ],
    };

    const sections = getExtraCostSections(schema);
    assert.strictEqual(sections.length, 1);
    assert.strictEqual(sections[0].name, 'section_a');
    assert.deepStrictEqual(sections[0].fieldNames, ['a_field_1', 'a_field_2']);
  });

  it('supports multiple extra cost sections in one schema', () => {
    const schema: StudySchema = {
      name: 'test',
      label: 'Test',
      fields: [
        { name: 'base', label: 'Base', type: 'input' },
        { name: 'extra_1', label: 'Extra 1', type: 'title', addsExtraCost: true },
        { name: 'e1_field', label: 'E1F', type: 'input' },
        { name: 'extra_2', label: 'Extra 2', type: 'title', addsExtraCost: true },
        { name: 'e2_field', label: 'E2F', type: 'input' },
      ],
    };

    const sections = getExtraCostSections(schema);
    assert.strictEqual(sections.length, 2);
    assert.strictEqual(sections[0].name, 'extra_1');
    assert.deepStrictEqual(sections[0].fieldNames, ['e1_field']);
    assert.strictEqual(sections[1].name, 'extra_2');
    assert.deepStrictEqual(sections[1].fieldNames, ['e2_field']);
  });

  it('handles section at end of fields array', () => {
    const schema: StudySchema = {
      name: 'test',
      label: 'Test',
      fields: [
        { name: 'base', label: 'Base', type: 'input' },
        { name: 'trailing', label: 'Trailing', type: 'title', addsExtraCost: true },
        { name: 't_field', label: 'TF', type: 'input' },
      ],
    };

    const sections = getExtraCostSections(schema);
    assert.strictEqual(sections.length, 1);
    assert.strictEqual(sections[0].name, 'trailing');
    assert.deepStrictEqual(sections[0].fieldNames, ['t_field']);
  });
});
