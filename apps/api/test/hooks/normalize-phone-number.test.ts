import assert from 'assert';
import normalizePhoneNumber from '../../src/services/whatsapp/hooks/normalize-phone-number';

describe('normalize-phone-number hook', () => {
  const hook = normalizePhoneNumber();

  it('normalizes a valid Argentine number in data.to', async () => {
    const context: any = {
      data: { to: '2214567890', organizationId: 'org1' },
    };

    await hook(context);

    assert.equal(context.data.to, '542214567890');
    assert.equal(context.result, undefined);
  });

  it('normalizes a number with +54 prefix', async () => {
    const context: any = {
      data: { to: '+542214567890', organizationId: 'org1' },
    };

    await hook(context);

    assert.equal(context.data.to, '542214567890');
  });

  it('normalizes a number with cel: prefix', async () => {
    const context: any = {
      data: { to: 'cel:+542214567890', organizationId: 'org1' },
    };

    await hook(context);

    assert.equal(context.data.to, '542214567890');
  });

  it('normalizes a non-AR number (Chile)', async () => {
    const context: any = {
      data: { to: '+56912345678', organizationId: 'org1' },
    };

    await hook(context);

    assert.equal(context.data.to, '56912345678');
  });

  it('short-circuits with invalid-phone-number for unfixable input', async () => {
    const context: any = {
      data: { to: '123', organizationId: 'org1' },
    };

    await hook(context);

    assert.deepStrictEqual(context.result, { sent: false, reason: 'invalid-phone-number' });
  });

  it('passes through for empty phone (falsy to)', async () => {
    const context: any = {
      data: { to: '', organizationId: 'org1' },
    };

    const result = await hook(context);

    assert.strictEqual(result, context);
    assert.equal(context.result, undefined);
  });

  it('passes through when data.to is missing', async () => {
    const context: any = {
      data: { organizationId: 'org1' },
    };

    const result = await hook(context);

    assert.strictEqual(result, context);
    assert.equal(context.result, undefined);
  });

  it('passes through when data.organizationId is missing', async () => {
    const context: any = {
      data: { to: '2214567890' },
    };

    const result = await hook(context);

    assert.strictEqual(result, context);
    assert.equal(context.result, undefined);
  });
});
