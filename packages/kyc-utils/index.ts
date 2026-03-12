// ── Image utilities ──

export function compressImage(file: Blob): Promise<Blob> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const maxDim = 4000;
      let w = img.width;
      let h = img.height;
      if (w > maxDim || h > maxDim) {
        const ratio = Math.min(maxDim / w, maxDim / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(blob => resolve(blob ?? file), 'image/jpeg', 0.85);
    };
    img.onerror = () => resolve(file);
    img.src = URL.createObjectURL(file);
  });
}

// ── Device fingerprint ──

export function collectDeviceFingerprint() {
  return {
    screenWidth: screen.width,
    screenHeight: screen.height,
    devicePixelRatio: window.devicePixelRatio || 1,
    platform: navigator.platform || '',
    language: navigator.language || '',
    languages: navigator.languages ? Array.from(navigator.languages) : [],
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
    timezoneOffset: new Date().getTimezoneOffset(),
    hardwareConcurrency: navigator.hardwareConcurrency || 0,
    maxTouchPoints: navigator.maxTouchPoints || 0,
    colorDepth: screen.colorDepth || 0,
  };
}

// ── Canvas / video helpers ──

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

function getVideoSnapshot(
  video: HTMLVideoElement,
  scale = 320
): { ctx: CanvasRenderingContext2D; w: number; h: number } | null {
  const w = scale;
  const h = Math.round((w * video.videoHeight) / video.videoWidth);
  if (h <= 0) return null;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, w, h);
  return { ctx, w, h };
}

/**
 * Detects MRZ-like text on the ID back by looking for horizontal rows of
 * high-contrast edges spanning most of the card width in the bottom 45%.
 */
export function detectMrzText(video: HTMLVideoElement): boolean {
  const snap = getVideoSnapshot(video);
  if (!snap) return false;
  const { ctx, w, h } = snap;

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
