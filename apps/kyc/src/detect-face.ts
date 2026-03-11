import path from 'path';

let initialized = false;
let faceapi: any;
let canvasModule: any;

function ensureInitialized(): void {
  if (initialized) return;

  canvasModule = require('canvas');
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

  modelsLoaded = true;
}

/**
 * Detects whether a face exists in the given image buffer.
 * Uses tinyFaceDetector only (no landmarks/recognition needed).
 */
export async function detectFace(imageBuffer: Buffer): Promise<boolean> {
  await ensureModelsLoaded();

  const img = await canvasModule.loadImage(imageBuffer);
  const detection = await faceapi.detectSingleFace(
    img,
    new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 })
  );

  return !!detection;
}
