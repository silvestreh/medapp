import assert from 'assert';
import app from '../../src/app';

describe('\'medications\' service', () => {
  let lab: any;

  before(async () => {
    await app.get('sequelizeSync');

    lab = await app.service('laboratories').create({
      name: 'Med Test Pharma Lab'
    });

    const seq = app.get('sequelizeClient');
    await seq.query(`
      INSERT INTO medications (id, "commercialNamePresentation", "genericDrug", "pharmaceuticalForm", "laboratoryId", "createdAt", "updatedAt")
      VALUES
        ('med-1', 'Ibuprofeno 400mg Comprimidos', 'Ibuprofeno', 'Comprimido', '${lab.id}', NOW(), NOW()),
        ('med-2', 'Amoxicilina 500mg Capsulas', 'Amoxicilina', 'Capsula', '${lab.id}', NOW(), NOW()),
        ('med-3', 'Paracetamol 500mg Comprimidos', 'Paracetamol', 'Comprimido', '${lab.id}', NOW(), NOW())
    `);
  });

  it('registered the service', () => {
    const service = app.service('medications');
    assert.ok(service, 'Registered the service');
  });

  it('finds medications', async () => {
    const result: any = await app.service('medications').find({ query: {} });
    assert.ok(result.data.length >= 3, 'Returns medications');
  });

  it('searches medications by $search term', async () => {
    const result: any = await app.service('medications').find({
      query: { $search: 'ibuprofeno' }
    });

    assert.ok(result.data.length >= 1, 'Found at least one result');
    assert.ok(
      result.data.some((m: any) =>
        m.genericDrug.toLowerCase().includes('ibuprofeno')
      ),
      'Found ibuprofeno'
    );
  });

  it('search is case-insensitive', async () => {
    const result: any = await app.service('medications').find({
      query: { $search: 'AMOXICILINA' }
    });

    assert.ok(result.data.length >= 1, 'Found results with uppercase search');
  });

  it('multi-word search narrows results', async () => {
    const broad: any = await app.service('medications').find({
      query: { $search: 'comprimidos' }
    });
    const narrow: any = await app.service('medications').find({
      query: { $search: 'ibuprofeno comprimidos' }
    });

    assert.ok(broad.data.length >= narrow.data.length, 'Multi-word search is at least as narrow');
    assert.ok(narrow.data.length >= 1, 'Multi-word search still returns results');
  });

  it('returns empty for non-matching search', async () => {
    const result: any = await app.service('medications').find({
      query: { $search: 'zzzznonexistent' }
    });

    assert.strictEqual(result.data.length, 0, 'No results for non-matching search');
  });
});
