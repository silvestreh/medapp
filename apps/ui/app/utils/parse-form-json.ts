import { json } from '@remix-run/node';

export function parseFormJson<T = unknown>(raw: FormDataEntryValue | null): T {
  try {
    return JSON.parse(String(raw || '{}')) as T;
  } catch {
    throw json({ error: 'Invalid JSON in form data' }, { status: 400 });
  }
}
