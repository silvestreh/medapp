import { useCallback, useEffect, useRef, useState } from 'react';
import { StepDef } from '../../steps';
import { getBarcodeDetector, getFaceLandmarker, getVideoImageData, detectMrzText } from '../detection';
import { compressImage } from '../utils';

type DetectStatus = '' | 'scanning' | 'detected' | 'recording' | 'face_lost';

const VIDEO_RECORD_DURATION_MS = 6000;

interface Props {
  step: StepDef;
  stepIndex: number;
  totalSteps: number;
  onCapture: (blob: Blob, previewUrl: string) => void;
}

export function CameraPhase({ step, stepIndex, totalSteps, onCapture }: Props) {
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
  const [recordProgress, setRecordProgress] = useState(0);
  const [glassesDetected, setGlassesDetected] = useState(false);

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

    const requiredDetections = step.autoDetect === 'text' ? 5 : 3;
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
                  setTimeout(doCapture, 300);
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
    } else if (step.autoDetect === 'text') {
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
  }, [step.autoDetect, doCapture, doVideoRecord]);

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
            .then(() => { if (activeRef.current) startAutoDetectionRef.current(); })
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
  const isAutoDetect = step.autoDetect !== 'none';
  const hint = isAutoDetect && detectStatus === 'scanning' ? step.cameraHintAuto : step.cameraHint;

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
    <div className="flex-1 flex flex-col bg-black relative">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="flex-1 w-full object-contain"
        style={isSelfie ? { transform: 'scaleX(-1)' } : undefined}
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
            transform: 'translate(-50%,-50%)', width: '85%', height: '45%', pointerEvents: 'none',
          }}
        >
          <rect
            x="10" y="10" width="380" height="240" rx="16" ry="16"
            fill="none" stroke={rectStroke} strokeWidth="3"
            strokeDasharray={detectStatus === 'detected' ? undefined : '8 4'}
          />
        </svg>
      )}

      {/* Top overlay */}
      <div
        className="absolute top-0 left-0 right-0 z-10"
        style={{
          padding: 'calc(1rem + env(safe-area-inset-top)) 1.25rem 1rem',
          background: 'linear-gradient(to bottom,rgba(0,0,0,0.5),transparent)',
        }}
      >
        <div className="text-white/70 text-xs uppercase tracking-widest mb-1">
          Paso {stepIndex + 1} de {totalSteps}
        </div>
        <div className="text-white text-[17px] font-semibold">{step.title}</div>
      </div>

      {/* Bottom overlay */}
      <div
        className="absolute bottom-0 left-0 right-0 flex flex-col items-center gap-3 z-10"
        style={{
          padding: '1rem 1.25rem calc(4rem + env(safe-area-inset-bottom))',
          background: 'linear-gradient(to top,rgba(0,0,0,0.6),transparent)',
        }}
      >
        <div className="text-white text-sm text-center" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
          {hint}
        </div>

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

        {detectStatus === 'recording' && (
          <div className="flex flex-col items-center gap-2">
            <div className="py-2 px-5 rounded-3xl text-sm font-semibold bg-red-500/90 text-white">
              Verificando...
            </div>
            <div className="w-32 h-1.5 rounded-full bg-white/20 overflow-hidden">
              <div
                className="h-full bg-red-500 rounded-full transition-all"
                style={{ width: `${recordProgress}%` }}
              />
            </div>
          </div>
        )}

        {detectStatus === 'detected' && (
          <div className="py-2 px-5 rounded-3xl text-sm font-semibold bg-green-500/90 text-white">Listo ✓</div>
        )}

        {detectStatus === 'scanning' && (
          <div className="py-2 px-5 rounded-3xl text-sm font-semibold bg-white/15 text-white animate-pulse">
            Verificando...
          </div>
        )}

        {detectStatus !== 'recording' && detectStatus !== 'face_lost' && (
          <button
            className="w-[72px] h-[72px] rounded-full border-4 border-white bg-white/25 cursor-pointer active:bg-white/50"
            onClick={handleManualCapture}
          />
        )}

        {!isSelfie && detectStatus !== 'recording' && detectStatus !== 'face_lost' && (
          <div className="flex gap-4">
            <input
              type="file"
              id="camera-file-input"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              className="bg-transparent border-none text-white/80 text-xs cursor-pointer py-1 px-2"
              onClick={handleFileClick}
            >
              Subir desde galería
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
