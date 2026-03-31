import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(customParseFormat);

export interface MrzScanData {
  firstName: string;
  lastName: string;
  documentNumber: string;
  nationality: string;
  birthDate: string;
  gender: string;
  expirationDate: string;
}

/**
 * Scans the MRZ (Machine Readable Zone) from a passport image.
 *
 * 1. Loads the image and crops the bottom ~35% (where MRZ is located)
 * 2. Preprocesses to high-contrast grayscale
 * 3. Runs Tesseract OCR with MRZ character whitelist
 * 4. Parses the TD3 format using the `mrz` package
 */
export async function scanPassportMrz(imageBuffer: Buffer): Promise<MrzScanData> {
  const { createCanvas, loadImage } = require('@napi-rs/canvas');
  const Tesseract = require('tesseract.js');
  const { parse: parseMRZ } = require('mrz');

  const image = await loadImage(imageBuffer);
  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0);

  // Crop bottom 35% of image where MRZ zone is located
  const cropY = Math.floor(image.height * 0.65);
  const cropHeight = image.height - cropY;
  const cropCanvas = createCanvas(image.width, cropHeight);
  const cropCtx = cropCanvas.getContext('2d');
  cropCtx.drawImage(image, 0, cropY, image.width, cropHeight, 0, 0, image.width, cropHeight);

  // Preprocess: convert to high-contrast grayscale for better OCR
  const imgData = cropCtx.getImageData(0, 0, image.width, cropHeight);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    // Threshold to pure black/white for MRZ text
    const val = gray < 128 ? 0 : 255;
    data[i] = val;
    data[i + 1] = val;
    data[i + 2] = val;
  }
  cropCtx.putImageData(imgData, 0, 0);

  const processedBuffer = cropCanvas.toBuffer('image/png');

  // OCR with Tesseract — whitelist MRZ characters only
  const result = await Tesseract.recognize(processedBuffer, 'eng', {
    tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<',
    tessedit_pageseg_mode: '6', // Assume uniform block of text
  });

  const ocrText = result.data.text.trim();
  const lines = ocrText
    .split('\n')
    .map((line: string) => line.replace(/\s/g, '').trim())
    .filter((line: string) => line.length >= 40);

  if (lines.length < 2) {
    throw new Error(`MRZ not readable: found ${lines.length} valid lines in OCR output`);
  }

  // Take the last two lines that are closest to 44 characters (TD3 format)
  const mrzLines = lines.slice(-2).map((line: string) => {
    // Pad or trim to exactly 44 characters
    if (line.length < 44) return line.padEnd(44, '<');
    if (line.length > 44) return line.substring(0, 44);
    return line;
  });

  // Parse MRZ using the `mrz` package
  let parsed: any;
  try {
    parsed = parseMRZ(mrzLines);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`MRZ parse failed: ${message}`);
  }

  const fields = parsed.fields;

  return {
    firstName: fields.firstName || '',
    lastName: fields.lastName || '',
    documentNumber: fields.documentNumber || '',
    nationality: fields.nationality || '',
    birthDate: fields.birthDate || '',
    gender: fields.sex || '',
    expirationDate: fields.expirationDate || '',
  };
}

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

/**
 * Cross-validates MRZ data against ID data from the database.
 * Returns an array of error messages. Empty array means all checks passed.
 *
 * MRZ names are often truncated, so we use fuzzy matching (startsWith / includes).
 */
export function validateMrzAgainstIdData(
  mrzData: MrzScanData,
  idData: {
    firstName?: string | null;
    lastName?: string | null;
    passportNumber?: string | null;
    birthDate?: string | null;
    gender?: string | null;
  }
): string[] {
  const errors: string[] = [];

  if (idData.passportNumber) {
    const expected = idData.passportNumber.replace(/\s/g, '').toUpperCase();
    const scanned = mrzData.documentNumber.replace(/\s/g, '').toUpperCase();
    if (expected !== scanned) {
      errors.push(`Passport number mismatch: scanned ${scanned}, DB has ${expected}`);
    }
  }

  if (idData.lastName) {
    const normalizedMrz = normalize(mrzData.lastName);
    const normalizedDb = normalize(idData.lastName);
    // MRZ may truncate names — check if one starts with the other
    if (!normalizedMrz.startsWith(normalizedDb) && !normalizedDb.startsWith(normalizedMrz)) {
      errors.push(`Last name mismatch: scanned "${mrzData.lastName}", DB has "${idData.lastName}"`);
    }
  }

  if (idData.firstName) {
    const normalizedMrz = normalize(mrzData.firstName);
    const normalizedDb = normalize(idData.firstName);
    // MRZ may truncate or reorder names — check if any part matches
    const mrzParts = normalizedMrz.split(/\s+/);
    const dbParts = normalizedDb.split(/\s+/);
    const hasMatch = dbParts.some(dbPart =>
      mrzParts.some(mrzPart => mrzPart.startsWith(dbPart) || dbPart.startsWith(mrzPart))
    );
    if (!hasMatch) {
      errors.push(`First name mismatch: scanned "${mrzData.firstName}", DB has "${idData.firstName}"`);
    }
  }

  if (idData.birthDate) {
    // MRZ birthDate is YYMMDD format
    const scannedDate = dayjs(mrzData.birthDate, 'YYMMDD', true);
    const dbDate = dayjs(idData.birthDate);
    if (scannedDate.isValid() && dbDate.isValid()) {
      if (!scannedDate.isSame(dbDate, 'day')) {
        errors.push(`Birth date mismatch: scanned ${mrzData.birthDate}, DB has ${dbDate.format('YYYY-MM-DD')}`);
      }
    }
  }

  if (idData.gender) {
    const genderMap: Record<string, string> = { male: 'male', female: 'female', M: 'male', F: 'female' };
    const scannedGender = genderMap[mrzData.gender] || mrzData.gender.toLowerCase();
    const dbGender = genderMap[idData.gender] || idData.gender.toLowerCase();
    if (scannedGender !== dbGender) {
      errors.push(`Gender mismatch: scanned "${mrzData.gender}", DB has "${idData.gender}"`);
    }
  }

  return errors;
}
