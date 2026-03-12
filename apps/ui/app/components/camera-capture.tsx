import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge, Button, Group, Paper, Progress, Stack, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { Camera, RotateCcw, Check, Video } from 'lucide-react';
import { getVideoImageData, detectMrzText } from '@athelas/kyc-utils';

type AutoDetectMode = 'barcode' | 'face' | 'text' | 'none';

interface CameraCaptureProps {
  facingMode: 'environment' | 'user';
  onCapture: (blob: Blob) => void;
  onCancel: () => void;
  label: string;
  autoDetect?: AutoDetectMode;
}

const VIDEO_RECORD_DURATION_MS = 6000;

// ── Lazy-loaded detection engines ──

// barcode-detector: polyfill for the BarcodeDetector API using zxing-wasm
// Only loaded when autoDetect === 'barcode'
let barcodeDetectorPromise: Promise<{
  detect: (source: ImageData) => Promise<Array<{ rawValue: string }>>;
}> | null = null;

function getBarcodeDetector() {
  if (!barcodeDetectorPromise) {
    barcodeDetectorPromise = import('barcode-detector').then(mod => {
      return new mod.BarcodeDetector({ formats: ['pdf417'] });
    });
  }
  return barcodeDetectorPromise;
}

// @mediapipe/tasks-vision FaceLandmarker: WASM-based face landmarks + head pose
// Only loaded when autoDetect === 'face'
interface FaceDetectResult {
  detected: boolean;
  lookingAtCamera: boolean;
}

const MAX_YAW_DEG = 20;
const MAX_PITCH_DEG = 15;

let faceLandmarkerPromise: Promise<{
  detect: (video: HTMLVideoElement) => FaceDetectResult;
}> | null = null;

function getFaceLandmarker() {
  if (!faceLandmarkerPromise) {
    faceLandmarkerPromise = import('@mediapipe/tasks-vision').then(async vision => {
      const { FaceLandmarker, FilesetResolver } = vision;
      const filesetResolver = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );
      const landmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
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

            // Extract head pose from the facial transformation matrix
            const matrices = result.facialTransformationMatrixes;
            if (!matrices || matrices.length === 0) {
              // Face detected but no pose data — assume looking at camera
              return { detected: true, lookingAtCamera: true };
            }

            const matrix = matrices[0].data;
            // 4x4 column-major rotation matrix → extract Euler angles
            // matrix layout (column-major): [m00, m10, m20, m30, m01, m11, m21, m31, m02, m12, m22, m32, ...]
            const m00 = matrix[0];
            const m10 = matrix[1];
            const m20 = matrix[2];

            const pitch = Math.asin(-m20) * (180 / Math.PI);
            const yaw = Math.atan2(m10, m00) * (180 / Math.PI);

            const lookingAtCamera = Math.abs(yaw) < MAX_YAW_DEG && Math.abs(pitch) < MAX_PITCH_DEG;
            return { detected: true, lookingAtCamera };
          } catch {
            return { detected: false, lookingAtCamera: false };
          }
        },
      };
    });
  }
  return faceLandmarkerPromise;
}

// ── Canvas helpers (imported from @athelas/kyc-utils) ──

// ── Component ──

export function CameraCapture({ facingMode, onCapture, onCancel, label, autoDetect = 'none' }: CameraCaptureProps) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIdRef = useRef<number | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const faceCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingAbortedRef = useRef(false);
  const startAutoDetectionRef = useRef<() => void>(() => {});
  const [captured, setCaptured] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detectStatus, setDetectStatus] = useState<'' | 'scanning' | 'detected' | 'recording' | 'face_lost'>('');
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
      blob => {
        if (blob) {
          setCaptured(canvas.toDataURL('image/jpeg', 0.9));
          setCapturedBlob(blob);
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
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

    recordingAbortedRef.current = false;
    setDetectStatus('recording');
    setRecordProgress(0);

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';

    const recorder = new MediaRecorder(stream, { mimeType });
    recorderRef.current = recorder;
    const chunks: Blob[] = [];

    recorder.ondataavailable = e => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => {
      recorderRef.current = null;
      if (faceCheckIntervalRef.current) {
        clearInterval(faceCheckIntervalRef.current);
        faceCheckIntervalRef.current = null;
      }

      if (recordingAbortedRef.current) {
        // Recording was aborted due to face loss — don't save, show warning and restart
        setDetectStatus('face_lost');
        setRecordProgress(0);
        setTimeout(() => {
          setDetectStatus('');
          startAutoDetectionRef.current();
        }, 2000);
        return;
      }

      const blob = new Blob(chunks, { type: 'video/webm' });
      const previewUrl = URL.createObjectURL(blob);
      setCaptured(previewUrl);
      setCapturedBlob(blob);
      setDetectStatus('');
      setRecordProgress(0);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };

    recorder.start();

    // Face tracking during recording — abort if face disappears or looks away
    let consecutiveMisses = 0;
    getFaceLandmarker()
      .then(landmarker => {
        faceCheckIntervalRef.current = setInterval(() => {
          const video = videoRef.current;
          if (!video || !video.videoWidth || recorder.state !== 'recording') return;

          const result = landmarker.detect(video);
          if (result.detected && result.lookingAtCamera) {
            consecutiveMisses = 0;
          } else {
            consecutiveMisses++;
            if (consecutiveMisses >= 2) {
              // Face lost or not looking at camera for ~400ms — abort recording
              recordingAbortedRef.current = true;
              clearInterval(faceCheckIntervalRef.current!);
              faceCheckIntervalRef.current = null;
              if (recorder.state === 'recording') {
                recorder.stop();
              }
            }
          }
        }, 200);
      })
      .catch(() => {
        // Face landmarker not available — skip tracking, recording proceeds normally
      });

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
      if (faceCheckIntervalRef.current) {
        clearInterval(faceCheckIntervalRef.current);
        faceCheckIntervalRef.current = null;
      }
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
    let faceLandmarker: Awaited<ReturnType<typeof getFaceLandmarker>> | null = null;

    // Load detectors asynchronously
    if (autoDetect === 'barcode') {
      getBarcodeDetector()
        .then(d => {
          barcodeDetector = d;
          detectorReady = true;
        })
        .catch(() => {
          // If barcode detector fails to load, scanning stays visible but won't auto-capture
        });
    } else if (autoDetect === 'face') {
      getFaceLandmarker()
        .then(d => {
          faceLandmarker = d;
          detectorReady = true;
        })
        .catch(() => {
          // If face landmarker fails to load, scanning stays visible but won't auto-capture
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
        // Crop to bottom 55% of frame — barcode is in lower portion of card,
        // this doubles effective barcode resolution without requiring close-up.
        const cropCanvas = document.createElement('canvas');
        const cropY = Math.floor(vid.videoHeight * 0.45);
        cropCanvas.width = vid.videoWidth;
        cropCanvas.height = vid.videoHeight - cropY;
        const cropCtx = cropCanvas.getContext('2d');
        if (!cropCtx) {
          scanIdRef.current = requestAnimationFrame(scanFrame);
          return;
        }
        cropCtx.drawImage(vid, 0, cropY, vid.videoWidth, cropCanvas.height, 0, 0, vid.videoWidth, cropCanvas.height);
        const imgData = cropCtx.getImageData(0, 0, cropCanvas.width, cropCanvas.height);
        if (!imgData) {
          scanIdRef.current = requestAnimationFrame(scanFrame);
          return;
        }
        barcodeDetector
          .detect(imgData)
          .then(results => {
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
          })
          .catch(() => {
            scanIdRef.current = requestAnimationFrame(scanFrame);
          });
      } else if (autoDetect === 'face' && faceLandmarker) {
        // Face landmark detection via MediaPipe — triggers video recording only if looking at camera
        const result = faceLandmarker.detect(vid);
        if (!streamRef.current) return;
        if (result.detected && result.lookingAtCamera) {
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

  startAutoDetectionRef.current = startAutoDetection;

  useEffect(() => {
    let active = true;

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 1280 }, height: { ideal: 960 } },
        });
        if (!active) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current
            .play()
            .then(() => {
              if (active) startAutoDetection();
            })
            .catch(() => {
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
      if (faceCheckIntervalRef.current) {
        clearInterval(faceCheckIntervalRef.current);
        faceCheckIntervalRef.current = null;
      }
      if (recorderRef.current && recorderRef.current.state === 'recording') {
        recorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
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
          videoRef.current
            .play()
            .then(() => {
              startAutoDetection();
            })
            .catch(() => {
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
          <Text c="red" size="sm">
            {error}
          </Text>
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
        <Text fw={600} size="sm">
          {label}
        </Text>

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
                  borderRadius: 8,
                  display: 'block',
                  transform: facingMode === 'user' ? 'scaleX(-1)' : undefined,
                }}
              />
              {isVideoMode && (
                <svg
                  viewBox="0 0 200 300"
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '45%',
                    height: '75%',
                    pointerEvents: 'none',
                  }}
                >
                  <ellipse
                    cx="100"
                    cy="150"
                    rx="90"
                    ry="140"
                    fill="none"
                    stroke={
                      detectStatus === 'recording'
                        ? '#fa5252'
                        : detectStatus === 'detected'
                          ? '#40c057'
                          : 'rgba(255,255,255,0.6)'
                    }
                    strokeWidth="3"
                    strokeDasharray={detectStatus === 'recording' ? 'none' : '8 4'}
                  />
                </svg>
              )}
              {!isVideoMode && (
                <svg
                  viewBox="0 0 400 260"
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '85%',
                    height: '80%',
                    pointerEvents: 'none',
                  }}
                >
                  <rect
                    x="10"
                    y="10"
                    width="380"
                    height="240"
                    rx="16"
                    ry="16"
                    fill="none"
                    stroke={detectStatus === 'detected' ? '#40c057' : 'rgba(255,255,255,0.6)'}
                    strokeWidth="3"
                    strokeDasharray={detectStatus === 'detected' ? 'none' : '8 4'}
                  />
                </svg>
              )}
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
              {detectStatus === 'face_lost' && (
                <Badge
                  color="orange"
                  variant="filled"
                  size="lg"
                  style={{
                    position: 'absolute',
                    bottom: 12,
                    left: '50%',
                    transform: 'translateX(-50%)',
                  }}
                >
                  {t('identity_verification.face_lost_during_recording')}
                </Badge>
              )}
              {detectStatus === 'recording' && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: 12,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
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
                {isVideoMode ? t('identity_verification.record_video') : t('identity_verification.capture')}
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
              <Button color="green" leftSection={<Check size={16} />} onClick={handleConfirm}>
                {t('identity_verification.confirm')}
              </Button>
              <Button variant="light" leftSection={<RotateCcw size={16} />} onClick={handleRetake}>
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
