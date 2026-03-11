import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge, Button, Group, Paper, Progress, Stack, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { Camera, RotateCcw, Check, Video } from 'lucide-react';

type AutoDetectMode = 'barcode' | 'face' | 'text' | 'none';

interface CameraCaptureProps {
  facingMode: 'environment' | 'user';
  onCapture: (blob: Blob) => void;
  onCancel: () => void;
  label: string;
  autoDetect?: AutoDetectMode;
}

const VIDEO_RECORD_DURATION_MS = 2000;

// ── Lazy-loaded detection engines ──

// barcode-detector: polyfill for the BarcodeDetector API using zxing-wasm
// Only loaded when autoDetect === 'barcode'
let barcodeDetectorPromise: Promise<{
  detect: (source: ImageData) => Promise<Array<{ rawValue: string }>>;
}> | null = null;

function getBarcodeDetector() {
  if (!barcodeDetectorPromise) {
    barcodeDetectorPromise = import('barcode-detector').then((mod) => {
      return new mod.BarcodeDetector({ formats: ['pdf417'] });
    });
  }
  return barcodeDetectorPromise;
}

// @mediapipe/tasks-vision FaceDetector: WASM-based face detection
// Only loaded when autoDetect === 'face'
let faceDetectorPromise: Promise<{
  detect: (video: HTMLVideoElement) => boolean;
}> | null = null;

function getFaceDetector() {
  if (!faceDetectorPromise) {
    faceDetectorPromise = import('@mediapipe/tasks-vision').then(async (vision) => {
      const { FaceDetector, FilesetResolver } = vision;
      const filesetResolver = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );
      const detector = await FaceDetector.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        minDetectionConfidence: 0.5,
      });
      let lastTimestamp = 0;
      return {
        detect: (video: HTMLVideoElement): boolean => {
          // MediaPipe VIDEO mode requires strictly increasing timestamps
          const timestamp = performance.now();
          if (timestamp <= lastTimestamp) return false;
          lastTimestamp = timestamp;
          try {
            const result = detector.detectForVideo(video, timestamp);
            return result.detections.length > 0;
          } catch {
            return false;
          }
        },
      };
    });
  }
  return faceDetectorPromise;
}

// ── Canvas helpers ──

/** Get ImageData from a video frame for barcode detection */
function getVideoImageData(video: HTMLVideoElement): ImageData | null {
  if (!video.videoWidth || !video.videoHeight) return null;
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

function getVideoSnapshot(video: HTMLVideoElement, scale = 320): { ctx: CanvasRenderingContext2D; w: number; h: number } | null {
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
 * Detect MRZ-like text on ID back by looking for:
 * 1. Multiple horizontal rows of high-contrast text in the bottom 40%
 * 2. Each row must span most of the card width (MRZ lines are full-width)
 * 3. At least 2 qualifying rows (Argentine DNI has 3 MRZ lines)
 */
function detectMrzText(video: HTMLVideoElement): boolean {
  const snap = getVideoSnapshot(video);
  if (!snap) return false;
  const { ctx, w, h } = snap;

  const startY = Math.floor(h * 0.55);
  const regionH = h - startY;
  if (regionH < 10) return false;

  const imgData = ctx.getImageData(0, startY, w, regionH);
  const data = imgData.data;

  // Build a row-by-row edge density profile
  let qualifyingRows = 0;
  const minRowWidth = Math.floor(w * 0.6); // MRZ spans at least 60% of width

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

    // Row qualifies if: dense edges (>12%) spanning most of the width
    if (density > 0.12 && edgeSpan > minRowWidth) {
      qualifyingRows++;
    }
  }

  // Need at least 6 qualifying rows (each MRZ line is ~2-3 pixel rows at this scale)
  return qualifyingRows >= 6;
}

// ── Component ──

export function CameraCapture({ facingMode, onCapture, onCancel, label, autoDetect = 'none' }: CameraCaptureProps) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIdRef = useRef<number | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const [captured, setCaptured] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detectStatus, setDetectStatus] = useState<'' | 'scanning' | 'detected' | 'recording'>('');
  const [recordProgress, setRecordProgress] = useState(0);

  const isVideoMode = autoDetect === 'face';

  const stopScanning = useCallback(() => {
    if (scanIdRef.current !== null) {
      cancelAnimationFrame(scanIdRef.current);
      scanIdRef.current = null;
    }
    setDetectStatus('');
  }, []);

  const doCapture = useCallback(() => {
    stopScanning();
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob) {
          setCaptured(canvas.toDataURL('image/jpeg', 0.9));
          setCapturedBlob(blob);
          if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
          }
        }
      },
      'image/jpeg',
      0.9
    );
  }, [stopScanning]);

  const doVideoRecord = useCallback(() => {
    stopScanning();
    const stream = streamRef.current;
    if (!stream) return;

    setDetectStatus('recording');
    setRecordProgress(0);

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm';

    const recorder = new MediaRecorder(stream, { mimeType });
    recorderRef.current = recorder;
    const chunks: Blob[] = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => {
      recorderRef.current = null;
      const blob = new Blob(chunks, { type: 'video/webm' });
      const previewUrl = URL.createObjectURL(blob);
      setCaptured(previewUrl);
      setCapturedBlob(blob);
      setDetectStatus('');
      setRecordProgress(0);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };

    recorder.start();

    // Progress animation
    const startTime = Date.now();
    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min((elapsed / VIDEO_RECORD_DURATION_MS) * 100, 100);
      setRecordProgress(progress);
      if (elapsed >= VIDEO_RECORD_DURATION_MS) {
        clearInterval(progressInterval);
      }
    }, 50);

    setTimeout(() => {
      clearInterval(progressInterval);
      if (recorder.state === 'recording') {
        recorder.stop();
      }
    }, VIDEO_RECORD_DURATION_MS);
  }, [stopScanning]);

  const startAutoDetection = useCallback(() => {
    if (autoDetect === 'none') return;

    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      setTimeout(startAutoDetection, 200);
      return;
    }

    setDetectStatus('scanning');

    let consecutiveDetections = 0;
    const requiredDetections = 3;
    let frameCount = 0;
    let detectorReady = false;
    let barcodeDetector: Awaited<ReturnType<typeof getBarcodeDetector>> | null = null;
    let faceDetector: Awaited<ReturnType<typeof getFaceDetector>> | null = null;

    // Load detectors asynchronously
    if (autoDetect === 'barcode') {
      getBarcodeDetector().then((d) => {
        barcodeDetector = d;
        detectorReady = true;
      }).catch(() => {
        // If barcode detector fails to load, scanning stays visible but won't auto-capture
      });
    } else if (autoDetect === 'face') {
      getFaceDetector().then((d) => {
        faceDetector = d;
        detectorReady = true;
      }).catch(() => {
        // If face detector fails to load, scanning stays visible but won't auto-capture
      });
    } else if (autoDetect === 'text') {
      detectorReady = true; // MRZ uses canvas, no async load needed
    }

    const scanFrame = () => {
      if (!streamRef.current || capturedBlob) return;
      const vid = videoRef.current;
      if (!vid || !vid.videoWidth || !detectorReady) {
        scanIdRef.current = requestAnimationFrame(scanFrame);
        return;
      }

      // Throttle scanning to every 6th frame (~10fps) to reduce CPU
      frameCount++;
      if (frameCount % 6 !== 0) {
        scanIdRef.current = requestAnimationFrame(scanFrame);
        return;
      }

      if (autoDetect === 'barcode' && barcodeDetector) {
        // Actually decode the barcode — only auto-captures when data is readable
        const imgData = getVideoImageData(vid);
        if (!imgData) {
          scanIdRef.current = requestAnimationFrame(scanFrame);
          return;
        }
        barcodeDetector.detect(imgData).then((results) => {
          if (!streamRef.current) return;
          // PDF417 on Argentine DNIs has a long data payload (~200+ chars)
          if (results && results.length > 0 && results[0].rawValue && results[0].rawValue.length > 50) {
            consecutiveDetections++;
            if (consecutiveDetections >= requiredDetections) {
              setDetectStatus('detected');
              setTimeout(doCapture, 300);
              return;
            }
          } else {
            consecutiveDetections = Math.max(0, consecutiveDetections - 1);
          }
          scanIdRef.current = requestAnimationFrame(scanFrame);
        }).catch(() => {
          scanIdRef.current = requestAnimationFrame(scanFrame);
        });
      } else if (autoDetect === 'face' && faceDetector) {
        // Real face detection via MediaPipe — triggers video recording
        const found = faceDetector.detect(vid);
        if (!streamRef.current) return;
        if (found) {
          consecutiveDetections++;
          if (consecutiveDetections >= requiredDetections) {
            setDetectStatus('detected');
            setTimeout(doVideoRecord, 300);
            return;
          }
        } else {
          consecutiveDetections = Math.max(0, consecutiveDetections - 1);
        }
        scanIdRef.current = requestAnimationFrame(scanFrame);
      } else if (autoDetect === 'text') {
        // Tightened MRZ detection
        const found = detectMrzText(vid);
        if (!streamRef.current) return;
        if (found) {
          consecutiveDetections++;
          if (consecutiveDetections >= requiredDetections) {
            setDetectStatus('detected');
            setTimeout(doCapture, 300);
            return;
          }
        } else {
          consecutiveDetections = Math.max(0, consecutiveDetections - 1);
        }
        scanIdRef.current = requestAnimationFrame(scanFrame);
      } else {
        // Detector not loaded yet, keep waiting
        scanIdRef.current = requestAnimationFrame(scanFrame);
      }
    };

    scanIdRef.current = requestAnimationFrame(scanFrame);
  }, [autoDetect, doCapture, doVideoRecord, capturedBlob]);

  useEffect(() => {
    let active = true;

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 1280 }, height: { ideal: 960 } },
        });
        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().then(() => {
            if (active) startAutoDetection();
          }).catch(() => {
            // Playback aborted — component likely unmounted
          });
        }
      } catch (err: unknown) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Camera access failed');
        }
      }
    };

    startCamera();

    return () => {
      active = false;
      stopScanning();
      if (recorderRef.current && recorderRef.current.state === 'recording') {
        recorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [facingMode, startAutoDetection, stopScanning]);

  const handleCapture = useCallback(() => {
    if (isVideoMode) {
      doVideoRecord();
    } else {
      doCapture();
    }
  }, [isVideoMode, doCapture, doVideoRecord]);

  const handleRetake = useCallback(() => {
    setCaptured(null);
    setCapturedBlob(null);
    setDetectStatus('');

    const restartCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 1280 }, height: { ideal: 960 } },
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().then(() => {
            startAutoDetection();
          }).catch(() => {
            // Playback aborted
          });
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Camera access failed');
      }
    };

    restartCamera();
  }, [facingMode, startAutoDetection]);

  const handleConfirm = useCallback(() => {
    if (capturedBlob) {
      onCapture(capturedBlob);
    }
  }, [capturedBlob, onCapture]);

  if (error) {
    return (
      <Paper withBorder p="md" radius="md">
        <Stack gap="sm" align="center">
          <Text c="red" size="sm">{error}</Text>
          <Button variant="light" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper withBorder p="md" radius="md">
      <Stack gap="sm">
        <Text fw={600} size="sm">{label}</Text>

        {!captured && (
          <>
            <div style={{ position: 'relative' }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{
                  width: '100%',
                  maxHeight: 300,
                  borderRadius: 8,
                  objectFit: 'cover',
                  transform: facingMode === 'user' ? 'scaleX(-1)' : undefined,
                }}
              />
              {detectStatus === 'scanning' && (
                <Badge
                  color="dark"
                  variant="filled"
                  size="lg"
                  style={{
                    position: 'absolute',
                    bottom: 12,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    opacity: 0.7,
                  }}
                >
                  {t('identity_verification.auto_scanning')}
                </Badge>
              )}
              {detectStatus === 'detected' && (
                <Badge
                  color="green"
                  variant="filled"
                  size="lg"
                  style={{
                    position: 'absolute',
                    bottom: 12,
                    left: '50%',
                    transform: 'translateX(-50%)',
                  }}
                >
                  {t('identity_verification.auto_detected')}
                </Badge>
              )}
              {detectStatus === 'recording' && (
                <div style={{
                  position: 'absolute',
                  bottom: 12,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                }}>
                  <Badge color="red" variant="filled" size="lg">
                    {t('identity_verification.recording_video')}
                  </Badge>
                  <Progress value={recordProgress} size="xs" color="red" w={120} />
                </div>
              )}
            </div>
            <Group>
              <Button
                leftSection={isVideoMode ? <Video size={16} /> : <Camera size={16} />}
                onClick={handleCapture}
                disabled={detectStatus === 'recording'}
              >
                {isVideoMode
                  ? t('identity_verification.record_video')
                  : t('identity_verification.capture')
                }
              </Button>
              <Button variant="light" onClick={onCancel}>
                {t('common.cancel')}
              </Button>
            </Group>
          </>
        )}

        {captured && (
          <>
            {isVideoMode && (
              <video
                src={captured}
                autoPlay
                loop
                muted
                playsInline
                style={{
                  width: '100%',
                  maxHeight: 300,
                  borderRadius: 8,
                  objectFit: 'contain',
                }}
              />
            )}
            {!isVideoMode && (
              <img
                src={captured}
                alt={label}
                style={{
                  width: '100%',
                  maxHeight: 300,
                  borderRadius: 8,
                  objectFit: 'contain',
                }}
              />
            )}
            <Group>
              <Button
                color="green"
                leftSection={<Check size={16} />}
                onClick={handleConfirm}
              >
                {t('identity_verification.confirm')}
              </Button>
              <Button
                variant="light"
                leftSection={<RotateCcw size={16} />}
                onClick={handleRetake}
              >
                {t('identity_verification.retake')}
              </Button>
            </Group>
          </>
        )}

        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </Stack>
    </Paper>
  );
}
