import path from 'path';
import { Hook, HookContext } from '@feathersjs/feathers';
import { BadRequest } from '@feathersjs/errors';
import { decryptFileFromDisk } from '../../../utils/decrypt-file';
import { detectFace } from '../../../utils/detect-face';

interface ValidationResult {
  hasBarcode: boolean;
  hasFace: boolean;
}

/**
 * Validates an uploaded ID front photo by checking for:
 * 1. A PDF417 barcode (Argentine DNI)
 * 2. A face
 *
 * This is a custom method on the identity-verifications service.
 * Called via POST /identity-verifications/validate-photo
 */
export async function validateIdPhoto(
  app: any,
  fileUrl: string,
): Promise<ValidationResult> {
  const uploadsDir = path.resolve(app.get('uploads')?.dir || './public/uploads');
  const buffer = decryptFileFromDisk(uploadsDir, fileUrl);

  const result: ValidationResult = {
    hasBarcode: false,
    hasFace: false,
  };

  // Check for PDF417 barcode
  try {
    const { createCanvas, loadImage } = require('canvas');
    const { readBarcodesFromImageData } = require('zxing-wasm/reader');

    const image = await loadImage(buffer);
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const results = await readBarcodesFromImageData(
      imageData as unknown as ImageData,
      { formats: ['PDF417'], tryHarder: true, tryRotate: true, tryInvert: true, maxNumberOfSymbols: 1 }
    );

    result.hasBarcode = results.length > 0;
  } catch (err) {
    console.error('[validate-photo] Barcode detection error:', err);
    result.hasBarcode = false;
  }

  // Check for face
  try {
    result.hasFace = await detectFace(buffer);
  } catch (err) {
    console.error('[validate-photo] Face detection error:', err);
    result.hasFace = false;
  }

  return result;
}
