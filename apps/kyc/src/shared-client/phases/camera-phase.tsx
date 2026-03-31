import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StepDef } from '../steps';
import { getBarcodeDetector, getFaceLandmarker, getVideoImageData, detectMrzText } from '../detection';
import { compressImage } from '../utils';
import { parseDniBarcodeText, validateBarcodeAgainstIdData, type IdData } from '../barcode-validation';

type DetectStatus = '' | 'scanning' | 'detected' | 'recording' | 'face_lost';

const VIDEO_RECORD_DURATION_MS = 6000;

interface Props {
  step: StepDef;
  stepIndex: number;
  totalSteps: number;
  onCapture: (blob: Blob, previewUrl: string) => void;
  onBack?: () => void;
  idData?: IdData;
  onError?: (error: { message: string; code: string; data?: Record<string, unknown> }) => void;
}

export function CameraPhase({ step, stepIndex, totalSteps, onCapture, onBack, idData, onError }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIdRef = useRef<number | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const faceCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingAbortedRef = useRef(false);
  // Guards against state updates / captures after unmount or step change
  const activeRef = useRef(true);

  const [cameraSupported, setCameraSupported] = useState(true);
  const [detectStatus, setDetectStatus] = useState<DetectStatus>('');
  const [idMismatchError, setIdMismatchError] = useState<string | null>(null);
  const [recordProgress, setRecordProgress] = useState(0);
  const [glassesDetected, setGlassesDetected] = useState(false);
  const [videoAspect, setVideoAspect] = useState<string | undefined>(undefined);

  // Keep a stable ref to startAutoDetection so recordVideo's onstop can restart it
  const startAutoDetectionRef = useRef<() => void>(() => {});

  const stopScanning = useCallback(() => {
    if (scanIdRef.current !== null) {
      cancelAnimationFrame(scanIdRef.current);
      scanIdRef.current = null;
    }
  }, []);

  const stopCamera = useCallback(() => {
    stopScanning();
    if (faceCheckIntervalRef.current) {
      clearInterval(faceCheckIntervalRef.current);
      faceCheckIntervalRef.current = null;
    }
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      recorderRef.current.stop();
      recorderRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, [stopScanning]);

  const doCapture = useCallback(() => {
    stopScanning();
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d')!;
    if (step.facing === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0);
    stopCamera();

    canvas.toBlob(blob => {
      if (!blob || !activeRef.current) return;
      onCapture(blob, URL.createObjectURL(blob));
    }, 'image/jpeg', 0.85);
  }, [step.facing, stopScanning, stopCamera, onCapture]);

  // Capture, validate barcode on the still, and check against idData.
  // If barcode not readable → silently retry.
  // If barcode doesn't match idData → fire onIdMismatch and stop.
  const doCaptureWithBarcodeValidation = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0);

    const cropY = Math.floor(canvas.height * 0.45);
    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = canvas.width;
    cropCanvas.height = canvas.height - cropY;
    const cropCtx = cropCanvas.getContext('2d');
    if (!cropCtx) { startAutoDetectionRef.current(); return; }
    cropCtx.drawImage(canvas, 0, cropY, canvas.width, cropCanvas.height, 0, 0, canvas.width, cropCanvas.height);
    const imgData = cropCtx.getImageData(0, 0, cropCanvas.width, cropCanvas.height);

    getBarcodeDetector().then(detector => {
      detector.detect(imgData).then(results => {
        if (!activeRef.current) return;
        const validResult = results?.find(r => r.rawValue && r.rawValue.length > 50);
        if (!validResult) {
          // Barcode not readable on still — keep scanning
          setDetectStatus('scanning');
          startAutoDetectionRef.current();
          return;
        }

        // Parse barcode data and validate against idData
        if (idData) {
          const barcodeData = parseDniBarcodeText(validResult.rawValue);
          if (barcodeData) {
            const errors = validateBarcodeAgainstIdData(barcodeData, idData);
            if (errors.length > 0) {
              stopScanning();
              stopCamera();
              setIdMismatchError('El DNI escaneado no coincide con los datos registrados.');
              if (onError) onError({
                message: 'El DNI escaneado no coincide con los datos registrados.',
                code: 'id_mismatch',
                data: {
                  firstName: barcodeData.firstName,
                  lastName: barcodeData.lastName,
                  dniNumber: barcodeData.dniNumber,
                  birthDate: barcodeData.birthDate,
                  gender: barcodeData.gender,
                },
              });
              return;
            }
          }
        }

        // Barcode valid and matches idData — proceed to preview
        stopScanning();
        stopCamera();
        canvas.toBlob(blob => {
          if (!blob || !activeRef.current) return;
          onCapture(blob, URL.createObjectURL(blob));
        }, 'image/jpeg', 0.85);
      }).catch(() => {
        if (activeRef.current) startAutoDetectionRef.current();
      });
    }).catch(() => {
      if (activeRef.current) startAutoDetectionRef.current();
    });
  }, [stopScanning, stopCamera, onCapture, idData, onError]);

  const doVideoRecord = useCallback(() => {
    stopScanning();
    const stream = streamRef.current;
    if (!stream) return;

    recordingAbortedRef.current = false;
    setDetectStatus('recording');
    setRecordProgress(0);

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm';
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
        if (!activeRef.current) return;
        setDetectStatus('face_lost');
        setRecordProgress(0);
        setTimeout(() => {
          if (!activeRef.current) return;
          setDetectStatus('');
          startAutoDetectionRef.current();
        }, 2000);
        return;
      }

      if (!activeRef.current) return;
      const blob = new Blob(chunks, { type: 'video/webm' });
      stopCamera();
      onCapture(blob, URL.createObjectURL(blob));
    };

    recorder.start();

    // Face tracking during recording — abort if face disappears or looks away
    getFaceLandmarker()
      .then(landmarker => {
        let consecutiveMisses = 0;
        faceCheckIntervalRef.current = setInterval(() => {
          const video = videoRef.current;
          if (!video || !video.videoWidth || recorder.state !== 'recording') return;
          const result = landmarker.detect(video);
          if (result.detected && result.lookingAtCamera && !result.wearingGlasses) {
            consecutiveMisses = 0;
          } else {
            consecutiveMisses++;
            if (consecutiveMisses >= 2) {
              recordingAbortedRef.current = true;
              clearInterval(faceCheckIntervalRef.current!);
              faceCheckIntervalRef.current = null;
              if (recorder.state === 'recording') recorder.stop();
            }
          }
        }, 200);
      })
      .catch(() => {});

    const startTime = Date.now();
    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      if (activeRef.current) setRecordProgress(Math.min((elapsed / VIDEO_RECORD_DURATION_MS) * 100, 100));
      if (elapsed >= VIDEO_RECORD_DURATION_MS) clearInterval(progressInterval);
    }, 50);

    setTimeout(() => {
      clearInterval(progressInterval);
      if (faceCheckIntervalRef.current) {
        clearInterval(faceCheckIntervalRef.current);
        faceCheckIntervalRef.current = null;
      }
      if (recorder.state === 'recording') recorder.stop();
    }, VIDEO_RECORD_DURATION_MS);
  }, [stopScanning, stopCamera, onCapture]);

  const startAutoDetection = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      setTimeout(() => { if (activeRef.current) startAutoDetectionRef.current(); }, 200);
      return;
    }
    if (step.autoDetect === 'none') return;

    if (activeRef.current) setDetectStatus('scanning');

    const requiredDetections = step.autoDetect === 'text' ? 3 : 1;
    let consecutiveDetections = 0;
    let frameCount = 0;

    if (step.autoDetect === 'barcode') {
      getBarcodeDetector()
        .then(detector => {
          const scanFrame = () => {
            if (!activeRef.current || !streamRef.current) return;
            const vid = videoRef.current;
            if (!vid || !vid.videoWidth) { scanIdRef.current = requestAnimationFrame(scanFrame); return; }

            frameCount++;
            if (frameCount % 6 !== 0) { scanIdRef.current = requestAnimationFrame(scanFrame); return; }

            // Crop to bottom 55% of frame — barcode is in lower portion of card,
            // this doubles effective barcode resolution without requiring close-up.
            const cropCanvas = document.createElement('canvas');
            const cropY = Math.floor(vid.videoHeight * 0.45);
            cropCanvas.width = vid.videoWidth;
            cropCanvas.height = vid.videoHeight - cropY;
            const cropCtx = cropCanvas.getContext('2d');
            if (!cropCtx) { scanIdRef.current = requestAnimationFrame(scanFrame); return; }
            cropCtx.drawImage(vid, 0, cropY, vid.videoWidth, cropCanvas.height, 0, 0, vid.videoWidth, cropCanvas.height);
            const imgData = cropCtx.getImageData(0, 0, cropCanvas.width, cropCanvas.height);

            detector.detect(imgData).then(results => {
              if (!activeRef.current || !streamRef.current) return;
              const valid = results && results.length > 0 && results[0].rawValue && results[0].rawValue.length > 50;
              if (valid) {
                consecutiveDetections++;
                if (consecutiveDetections >= requiredDetections) {
                  setDetectStatus('detected');
                  setTimeout(doCaptureWithBarcodeValidation, 300);
                  return;
                }
              } else {
                consecutiveDetections = Math.max(0, consecutiveDetections - 1);
              }
              scanIdRef.current = requestAnimationFrame(scanFrame);
            }).catch(() => { scanIdRef.current = requestAnimationFrame(scanFrame); });
          };
          scanIdRef.current = requestAnimationFrame(scanFrame);
        })
        .catch(() => {});
    } else if (step.autoDetect === 'face') {
      getFaceLandmarker()
        .then(landmarker => {
          const scanFrame = () => {
            if (!activeRef.current || !streamRef.current) return;
            const vid = videoRef.current;
            if (!vid || !vid.videoWidth) { scanIdRef.current = requestAnimationFrame(scanFrame); return; }

            frameCount++;
            if (frameCount % 6 !== 0) { scanIdRef.current = requestAnimationFrame(scanFrame); return; }

            const result = landmarker.detect(vid);
            if (result.wearingGlasses) {
              setGlassesDetected(true);
              consecutiveDetections = 0;
            } else {
              setGlassesDetected(false);
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
            }
            scanIdRef.current = requestAnimationFrame(scanFrame);
          };
          scanIdRef.current = requestAnimationFrame(scanFrame);
        })
        .catch(() => {});
    } else if (step.autoDetect === 'text' || step.autoDetect === 'mrz') {
      const scanFrame = () => {
        if (!activeRef.current || !streamRef.current) return;
        const vid = videoRef.current;
        if (!vid || !vid.videoWidth) { scanIdRef.current = requestAnimationFrame(scanFrame); return; }

        frameCount++;
        if (frameCount % 6 !== 0) { scanIdRef.current = requestAnimationFrame(scanFrame); return; }

        const found = detectMrzText(vid);
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
      };
      scanIdRef.current = requestAnimationFrame(scanFrame);
    }
  }, [step.autoDetect, doCapture, doCaptureWithBarcodeValidation, doVideoRecord]);

  // Keep the ref up to date so onstop can call the latest version
  startAutoDetectionRef.current = startAutoDetection;

  useEffect(() => {
    activeRef.current = true;
    setDetectStatus('');
    setCameraSupported(true);
    setGlassesDetected(false);

    // Pre-load heavy detectors without blocking
    if (step.autoDetect === 'face') getFaceLandmarker().catch(() => {});
    if (step.autoDetect === 'barcode') getBarcodeDetector().catch(() => {});

    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: step.facing as ConstrainDOMString, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      })
      .then(stream => {
        if (!activeRef.current) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          video.play()
            .then(() => {
              if (!activeRef.current) return;
              if (video.videoWidth && video.videoHeight) {
                setVideoAspect(`${video.videoWidth} / ${video.videoHeight}`);
              }
              startAutoDetectionRef.current();
            })
            .catch(() => {});
        }
      })
      .catch(() => {
        if (activeRef.current) setCameraSupported(false);
      });

    return () => {
      activeRef.current = false;
      stopCamera();
    };
  }, [step.key]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleManualCapture = useCallback(() => {
    if (step.key === 'selfie') {
      if (glassesDetected) return;
      doVideoRecord();
    } else {
      doCapture();
    }
  }, [step.key, doCapture, doVideoRecord, glassesDetected]);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const blob = await compressImage(file);
    if (!activeRef.current) return;
    stopCamera();
    onCapture(blob, URL.createObjectURL(blob));
  }, [stopCamera, onCapture]);

  const handleFileClick = useCallback(() => {
    document.getElementById('camera-file-input')?.click();
  }, []);

  const isSelfie = step.facing === 'user';
  const hint = step.cameraHint;

  const ovalStroke =
    detectStatus === 'recording' ? '#fa5252' : detectStatus === 'detected' ? '#40c057' : 'rgba(255,255,255,0.6)';
  const rectStroke = detectStatus === 'detected' ? '#40c057' : 'rgba(255,255,255,0.6)';

  if (!cameraSupported) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center px-6 py-8 text-center max-w-[420px] mx-auto w-full">
        <h2 className="text-xl font-bold mb-2">{step.title}</h2>
        {isSelfie && (
          <p className="text-gray-500 text-sm">
            Se necesita acceso a la cámara para tomar la selfie. Por favor habilitá el acceso a la cámara en los
            ajustes de tu navegador.
          </p>
        )}
        {!isSelfie && (
          <>
            <p className="text-gray-500 text-sm mb-6">{step.cameraHint}</p>
            <input
              type="file"
              id="camera-file-input"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              className="block w-full py-4 border-none rounded-xl text-base font-semibold cursor-pointer text-center bg-primary-400 text-white"
              onClick={handleFileClick}
            >
              Tomar foto
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100">
          {onBack && (
            <button
              className="bg-transparent border-none text-gray-400 cursor-pointer p-0 text-lg leading-none"
              onClick={onBack}
              aria-label="Volver"
            >
              ←
            </button>
          )}
          <div>
            <div className="text-gray-400 text-xs uppercase tracking-widest">
              Paso {stepIndex + 1} de {totalSteps}
            </div>
            <div className="text-gray-800 text-[15px] font-semibold">{step.title}</div>
          </div>
          <div className="ml-auto text-gray-400 text-xs text-right max-w-[45%]">
            {hint}
          </div>
        </div>

      <div className="relative overflow-hidden rounded-xl mx-4 mt-2">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="block w-full"
        style={{
          aspectRatio: videoAspect,
          ...(isSelfie ? { transform: 'scaleX(-1)' } : undefined),
        }}
      />

      {/* Guide overlay */}
      {isSelfie && (
        <svg
          viewBox="0 0 200 300"
          style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%,-50%)', width: '45%', height: '60%', pointerEvents: 'none',
          }}
        >
          <ellipse
            cx="100" cy="150" rx="90" ry="140"
            fill="none" stroke={ovalStroke} strokeWidth="3"
            strokeDasharray={detectStatus === 'recording' ? undefined : '8 4'}
          />
        </svg>
      )}

      {!isSelfie && (
        <svg
          viewBox="0 0 400 260"
          style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%,-50%)', width: '92%', height: '70%', pointerEvents: 'none',
          }}
        >
          <rect
            x="10" y="10" width="380" height="240" rx="16" ry="16"
            fill="none" stroke={rectStroke} strokeWidth="3"
            strokeDasharray={detectStatus === 'detected' ? undefined : '8 4'}
          />
        </svg>
      )}


      {/* Floating warnings */}
      {(detectStatus === 'face_lost' || glassesDetected) && (
        <div className="absolute bottom-6 left-0 right-0 flex justify-center z-10">
          {detectStatus === 'face_lost' && (
            <div className="py-2 px-5 rounded-3xl text-sm font-semibold bg-orange-500/90 text-white">
              Mantené la mirada en la cámara
            </div>
          )}
          {glassesDetected && detectStatus !== 'recording' && (
            <div className="py-2 px-5 rounded-3xl text-sm font-semibold bg-orange-500/90 text-white">
              Quitá los anteojos para continuar
            </div>
          )}
        </div>
      )}

      {/* Recording progress */}
      {detectStatus === 'recording' && (
        <div className="absolute bottom-6 left-0 right-0 flex justify-center z-10">
          <div className="w-32 h-1.5 rounded-full bg-white/20 overflow-hidden">
            <div
              className="h-full bg-red-500 rounded-full transition-all"
              style={{ width: `${recordProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* ID mismatch error overlay */}
      {idMismatchError && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-20 px-6 text-center">
          <div className="w-14 h-14 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center text-2xl mb-4">
            ✗
          </div>
          <div className="text-white text-lg font-semibold mb-2">Documento no válido</div>
          <p className="text-white/70 text-sm mb-6 max-w-[300px]">{idMismatchError}</p>
          {onBack && (
            <button
              className="py-3 px-8 rounded-xl border border-white/30 bg-transparent text-white text-sm font-medium cursor-pointer"
              onClick={onBack}
            >
              Volver
            </button>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
