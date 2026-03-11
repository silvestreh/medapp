import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import type { ReaderOptions } from 'zxing-wasm/reader';

dayjs.extend(customParseFormat);

export interface DniScanData {
  tramiteNumber: string;
  lastName: string;
  firstName: string;
  gender: string;
  dniNumber: string;
  exemplar: string;
  birthDate: string;
  issueDate: string;
}

/**
 * Scans the PDF417 barcode on the front of an Argentine DNI and extracts personal data.
 *
 * The Argentine DNI PDF417 barcode encodes data as @-separated fields:
 * tramiteNumber@lastName@firstName@gender@dniNumber@exemplar@birthDate@issueDate
 *
 * birthDate and issueDate are in DD/MM/YYYY format.
 */
export async function scanDniBarcode(imageBuffer: Buffer): Promise<DniScanData> {
  const { createCanvas, loadImage } = require('@napi-rs/canvas');
  const { readBarcodesFromImageData } = require('zxing-wasm/reader');

  const image = await loadImage(imageBuffer);
  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const readerOptions: ReaderOptions = {
    formats: ['PDF417'],
    tryHarder: true,
    tryRotate: true,
    tryInvert: true,
    maxNumberOfSymbols: 1,
  };

  const results = await readBarcodesFromImageData(imageData as unknown as ImageData, readerOptions);

  if (results.length === 0) {
    throw new Error('No PDF417 barcode found in the image');
  }

  const barcodeText = results[0].text;
  return parseDniBarcodeText(barcodeText);
}

export function parseDniBarcodeText(text: string): DniScanData {
  const fields = text.split('@');

  if (fields[0] === '') {
    fields.shift();
  }

  if (fields.length < 8) {
    throw new Error(`Invalid DNI barcode format: expected at least 8 fields, got ${fields.length}`);
  }

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

/**
 * Cross-validates DNI barcode data against personal data from the database.
 * Returns an array of error messages. Empty array means all checks passed.
 */
export function validateDniAgainstPersonalData(
  dniData: DniScanData,
  personalData: {
    firstName?: string | null;
    lastName?: string | null;
    documentValue?: string | null;
    birthDate?: string | null;
    gender?: string | null;
  }
): string[] {
  const errors: string[] = [];

  if (personalData.documentValue) {
    const dbDni = personalData.documentValue.replace(/\D/g, '');
    const scannedDni = dniData.dniNumber.replace(/\D/g, '');
    if (dbDni !== scannedDni) {
      errors.push(`DNI number mismatch: scanned ${scannedDni}, DB has ${dbDni}`);
    }
  }

  if (personalData.lastName) {
    const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    if (normalize(dniData.lastName) !== normalize(personalData.lastName)) {
      errors.push(`Last name mismatch: scanned "${dniData.lastName}", DB has "${personalData.lastName}"`);
    }
  }

  if (personalData.firstName) {
    const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    if (normalize(dniData.firstName) !== normalize(personalData.firstName)) {
      errors.push(`First name mismatch: scanned "${dniData.firstName}", DB has "${personalData.firstName}"`);
    }
  }

  if (personalData.birthDate) {
    const scannedDate = dayjs(dniData.birthDate, 'DD/MM/YYYY', true);
    const dbDate = dayjs(personalData.birthDate);
    if (scannedDate.isValid() && dbDate.isValid()) {
      if (!scannedDate.isSame(dbDate, 'day')) {
        errors.push(`Birth date mismatch: scanned ${dniData.birthDate}, DB has ${dbDate.format('YYYY-MM-DD')}`);
      }
    }
  }

  if (personalData.gender) {
    const genderMap: Record<string, string> = { M: 'male', F: 'female' };
    const scannedGender = genderMap[dniData.gender.toUpperCase()] || dniData.gender.toLowerCase();
    if (scannedGender !== personalData.gender) {
      errors.push(`Gender mismatch: scanned "${dniData.gender}", DB has "${personalData.gender}"`);
    }
  }

  return errors;
}
