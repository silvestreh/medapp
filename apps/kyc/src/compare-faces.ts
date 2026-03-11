import path from 'path';

let initialized = false;
let faceapi: any;
let canvasModule: any;

function ensureInitialized(): void {
  if (initialized) return;

  canvasModule = require('@napi-rs/canvas');
  const { Canvas, Image, ImageData: CanvasImageData } = canvasModule;

  faceapi = require('face-api.js');

  faceapi.env.monkeyPatch({
    Canvas,
    Image,
    ImageData: CanvasImageData,
    createCanvasElement: () => new Canvas(1, 1),
    createImageElement: () => new Image(),
  });

  initialized = true;
}

let modelsLoaded = false;

async function ensureModelsLoaded(): Promise<void> {
  ensureInitialized();

  if (modelsLoaded) return;

  const modelsDir = path.resolve(__dirname, '../face-models');
  await faceapi.nets.tinyFaceDetector.loadFromDisk(modelsDir);
  await faceapi.nets.faceLandmark68Net.loadFromDisk(modelsDir);
  await faceapi.nets.faceRecognitionNet.loadFromDisk(modelsDir);

  modelsLoaded = true;
}

async function getDescriptor(imageBuffer: Buffer): Promise<Float32Array> {
  const img = await canvasModule.loadImage(imageBuffer);

  const detection = await faceapi
    .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!detection) {
    throw new Error('No face detected in image');
  }

  return detection.descriptor;
}

export interface FaceComparisonResult {
  similarity: number;
  match: boolean;
}

/**
 * Compares faces from two images (ID front and selfie) using face-api.js.
 * Uses tinyFaceDetector to keep memory usage low.
 *
 * @returns similarity score (0-1) and boolean match (distance < 0.6)
 */
export async function compareFaces(
  idFrontBuffer: Buffer,
  selfieBuffer: Buffer,
): Promise<FaceComparisonResult> {
  await ensureModelsLoaded();

  let idDescriptor: Float32Array;
  let selfieDescriptor: Float32Array;

  try {
    idDescriptor = await getDescriptor(idFrontBuffer);
  } catch {
    throw new Error('No face detected in ID front photo');
  }

  try {
    selfieDescriptor = await getDescriptor(selfieBuffer);
  } catch {
    throw new Error('No face detected in selfie');
  }

  const distance = faceapi.euclideanDistance(idDescriptor, selfieDescriptor);
  const similarity = Math.max(0, 1 - distance);
  const match = distance < 0.5;

  return { similarity, match };
}
