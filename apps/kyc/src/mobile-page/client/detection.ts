// ── Barcode detector ──
// Loaded lazily from CDN (barcode-detector@3, zxing-wasm based polyfill)
// Works on all browsers, unlike the native BarcodeDetector API.

interface BarcodeResult {
  rawValue: string;
}

interface BarcodeDetectorInstance {
  detect: (source: ImageData | HTMLImageElement) => Promise<BarcodeResult[]>;
}

let barcodeDetectorPromise: Promise<BarcodeDetectorInstance> | null = null;

export function getBarcodeDetector(): Promise<BarcodeDetectorInstance> {
  if (!barcodeDetectorPromise) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore — URL-based dynamic import, not a local module
    barcodeDetectorPromise = import('https://cdn.jsdelivr.net/npm/barcode-detector@3/+esm').then((mod: any) => {
      return new mod.BarcodeDetector({ formats: ['pdf417'] }) as BarcodeDetectorInstance;
    });
  }
  return barcodeDetectorPromise;
}

// ── Face landmarker ──
// Loaded lazily from CDN (@mediapipe/tasks-vision, large WASM model)

export interface FaceDetectResult {
  detected: boolean;
  lookingAtCamera: boolean;
}

interface FaceLandmarkerInstance {
  detect: (video: HTMLVideoElement) => FaceDetectResult;
}

const MAX_YAW_DEG = 20;
const MAX_PITCH_DEG = 15;

let faceLandmarkerPromise: Promise<FaceLandmarkerInstance> | null = null;

export function getFaceLandmarker(): Promise<FaceLandmarkerInstance> {
  if (!faceLandmarkerPromise) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore — URL-based dynamic import, not a local module
    faceLandmarkerPromise = import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/+esm').then(async (vision: any) => {
      const fileset = await vision.FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );
      const landmarker = await vision.FaceLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numFaces: 1,
        outputFacialTransformationMatrixes: true,
      });

      let lastTimestamp = 0;

      return {
        detect: (video: HTMLVideoElement): FaceDetectResult => {
          const timestamp = performance.now();
          if (timestamp <= lastTimestamp) return { detected: false, lookingAtCamera: false };
          lastTimestamp = timestamp;
          try {
            const result = landmarker.detectForVideo(video, timestamp);
            if (!result.faceLandmarks || result.faceLandmarks.length === 0) {
              return { detected: false, lookingAtCamera: false };
            }
            const matrices = result.facialTransformationMatrixes;
            if (!matrices || matrices.length === 0) {
              return { detected: true, lookingAtCamera: true };
            }
            const matrix = matrices[0].data;
            const m00 = matrix[0];
            const m10 = matrix[1];
            const m20 = matrix[2];
            const pitch = Math.asin(-m20) * (180 / Math.PI);
            const yaw = Math.atan2(m10, m00) * (180 / Math.PI);
            return {
              detected: true,
              lookingAtCamera: Math.abs(yaw) < MAX_YAW_DEG && Math.abs(pitch) < MAX_PITCH_DEG,
            };
          } catch {
            return { detected: false, lookingAtCamera: false };
          }
        },
      };
    });
  }
  return faceLandmarkerPromise;
}

// ── Canvas helpers ──

export function getVideoImageData(video: HTMLVideoElement): ImageData | null {
  if (!video.videoWidth || !video.videoHeight) return null;
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/**
 * Detects MRZ-like text on the ID back by looking for horizontal rows of
 * high-contrast edges spanning most of the card width in the bottom 45%.
 */
export function detectMrzText(video: HTMLVideoElement): boolean {
  const w = 320;
  const h = Math.round((w * video.videoHeight) / video.videoWidth);
  if (h <= 0) return false;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;
  ctx.drawImage(video, 0, 0, w, h);

  const startY = Math.floor(h * 0.55);
  const regionH = h - startY;
  if (regionH < 10) return false;

  const imgData = ctx.getImageData(0, startY, w, regionH);
  const data = imgData.data;
  const minRowWidth = Math.floor(w * 0.6);
  let qualifyingRows = 0;

  for (let y = 1; y < regionH - 1; y++) {
    let edgePixels = 0;
    let firstEdge = w;
    let lastEdge = 0;
    for (let x = 1; x < w - 1; x++) {
      const idx = (y * w + x) * 4;
      const gray = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
      const idxAbove = ((y - 1) * w + x) * 4;
      const grayAbove = data[idxAbove] * 0.299 + data[idxAbove + 1] * 0.587 + data[idxAbove + 2] * 0.114;
      if (Math.abs(gray - grayAbove) > 40) {
        edgePixels++;
        if (x < firstEdge) firstEdge = x;
        if (x > lastEdge) lastEdge = x;
      }
    }
    const edgeSpan = lastEdge - firstEdge;
    const density = edgePixels / w;
    if (density > 0.12 && edgeSpan > minRowWidth) qualifyingRows++;
  }

  return qualifyingRows >= 6;
}
