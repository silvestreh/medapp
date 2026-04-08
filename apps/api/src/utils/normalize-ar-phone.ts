import { parsePhoneNumberWithError, PhoneNumber } from 'libphonenumber-js';

/**
 * Normalizes a phone number to the format Evolution API expects:
 * country code + local digits, no "+" prefix. E.g., "542214567890".
 *
 * Uses libphonenumber-js for parsing and validation, defaulting to Argentina
 * when no country code is present. Handles legacy data quirks like cel:/tel:
 * prefixes and the Argentine domestic "15" mobile prefix.
 *
 * Supports AR, CL (56), BO (591), BR (55), PY (595), UY (598).
 *
 * @param rawPhone - The phone string (may have cel:/tel: prefix, spaces, dashes, etc.)
 * @returns Normalized phone digits (e.g., "542214567890") or null if unparseable
 */
export function normalizePhone(rawPhone: string): string | null {
  // Strip cel:/tel: prefix
  let cleaned = String(rawPhone).replace(/^(cel|tel):/i, '').trim();
  if (!cleaned) return null;

  // Strip leading 00 (international dialing prefix)
  if (cleaned.startsWith('00') && !cleaned.startsWith('+')) {
    cleaned = '+' + cleaned.slice(2);
  }

  const digits = cleaned.replace(/[^0-9]/g, '');
  if (!digits) return null;

  // 1. Try parsing as-is (handles numbers that already have "+" or are in national format)
  let parsed = tryParse(cleaned, 'AR');
  if (parsed) return formatResult(parsed);

  // 2. Try with "+" prefix (handles "542214567890" without "+")
  if (digits.length >= 10) {
    parsed = tryParse(`+${digits}`, undefined);
    if (parsed) return formatResult(parsed);
  }

  // 3. Handle the Argentine domestic "15" prefix embedded after area code.
  //    12 digits local = areaCode(2-4) + "15" + subscriber = always 12.
  //    Strip the "15" and retry as a 10-digit Argentine number.
  if (digits.length === 12) {
    for (const areaLen of [2, 3, 4]) {
      if (digits.slice(areaLen, areaLen + 2) === '15') {
        const without15 = digits.slice(0, areaLen) + digits.slice(areaLen + 2);
        parsed = tryParse(without15, 'AR');
        if (parsed) return formatResult(parsed);
      }
    }
  }

  // 4. Same for 14-digit numbers: "54" + 12-digit local with embedded "15"
  if (digits.length === 14 && digits.startsWith('54')) {
    const local = digits.slice(2);
    for (const areaLen of [2, 3, 4]) {
      if (local.slice(areaLen, areaLen + 2) === '15') {
        const without15 = local.slice(0, areaLen) + local.slice(areaLen + 2);
        parsed = tryParse(without15, 'AR');
        if (parsed) return formatResult(parsed);
      }
    }
  }

  // 5. Handle leading "15" without area code (e.g., "154567890").
  //    Strip "15" and retry — if the remainder is a valid subscriber for the
  //    default country, libphonenumber won't parse it (too short), so this
  //    is a best-effort attempt.
  if (digits.startsWith('15') && digits.length < 11) {
    parsed = tryParse(digits.slice(2), 'AR');
    if (parsed) return formatResult(parsed);
  }

  return null;
}

function tryParse(input: string, defaultCountry: string | undefined): PhoneNumber | null {
  try {
    const parsed = parsePhoneNumberWithError(input, defaultCountry as any);
    if (parsed?.isValid()) return parsed;
  } catch {
    // libphonenumber throws on unparseable input
  }
  return null;
}

function formatResult(parsed: PhoneNumber): string {
  // E.164 without the leading "+"
  return parsed.number.replace(/^\+/, '');
}
