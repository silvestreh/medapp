export interface DniBarcodeData {
  tramiteNumber: string;
  lastName: string;
  firstName: string;
  gender: string;
  dniNumber: string;
  exemplar: string;
  birthDate: string;
  issueDate: string;
}

export interface IdData {
  firstName?: string | null;
  lastName?: string | null;
  dniNumber?: string | null;
  passportNumber?: string | null;
  birthDate?: string | null;
  gender?: string | null;
}

export function parseDniBarcodeText(text: string): DniBarcodeData | null {
  const fields = text.split('@');
  if (fields[0] === '') fields.shift();
  if (fields.length < 8) return null;

  return {
    tramiteNumber: fields[0].trim(),
    lastName: fields[1].trim(),
    firstName: fields[2].trim(),
    gender: fields[3].trim(),
    dniNumber: fields[4].trim(),
    exemplar: fields[5].trim(),
    birthDate: fields[6].trim(),
    issueDate: fields[7].trim(),
  };
}

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

export function validateBarcodeAgainstIdData(
  barcodeData: DniBarcodeData,
  idData: IdData,
): string[] {
  const errors: string[] = [];

  if (idData.dniNumber) {
    const expected = idData.dniNumber.replace(/\D/g, '');
    const scanned = barcodeData.dniNumber.replace(/\D/g, '');
    if (expected !== scanned) {
      errors.push('dni_mismatch');
    }
  }

  if (idData.lastName) {
    if (normalize(barcodeData.lastName) !== normalize(idData.lastName)) {
      errors.push('lastname_mismatch');
    }
  }

  if (idData.firstName) {
    if (normalize(barcodeData.firstName) !== normalize(idData.firstName)) {
      errors.push('firstname_mismatch');
    }
  }

  return errors;
}
