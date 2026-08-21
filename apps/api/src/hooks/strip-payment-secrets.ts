import { Hook, HookContext } from '@feathersjs/feathers';

// Defense-in-depth: no payment credential material may ever leave through a
// Feathers service response, internal or external. The payment services never
// SELECT these columns on their public paths, so this hook should always be a
// no-op — it exists so a future refactor can't silently start leaking tokens.
const SECRET_FIELDS = ['accessToken', 'refreshToken', 'codeVerifier'];

const stripRecord = (record: unknown): void => {
  if (!record || typeof record !== 'object') {
    return;
  }

  for (const field of SECRET_FIELDS) {
    delete (record as Record<string, unknown>)[field];
  }
};

const stripPaymentSecrets = (): Hook => async (context: HookContext): Promise<HookContext> => {
  const { result } = context;

  if (!result) {
    return context;
  }

  if (Array.isArray(result)) {
    result.forEach(stripRecord);
  } else if (Array.isArray((result as { data?: unknown[] }).data)) {
    (result as { data: unknown[] }).data.forEach(stripRecord);
  } else {
    stripRecord(result);
  }

  return context;
};

export default stripPaymentSecrets;
