import React, { useCallback, useEffect, useRef, useState } from 'react';
import { STEPS } from '../../shared-client/steps';
import type { IdData } from '../../shared-client/barcode-validation';
import { uploadFile, patchSession } from '../../shared-client/api';
import { collectDeviceFingerprint, collectGeolocation } from '../../shared-client/utils';
import type { GeolocationData } from '../../shared-client/utils';
import { CameraPhase } from '../../shared-client/phases/camera-phase';
import { IntermediatePhase } from '../../shared-client/phases/intermediate-phase';
import { PreviewPhase } from '../../shared-client/phases/preview-phase';
import { DonePhase } from '../../shared-client/phases/done-phase';
import { ErrorToast } from '../../shared-client/components/error-toast';
import { QrFallback } from './qr-fallback';

type Phase = 'intro' | 'camera' | 'intermediate' | 'preview' | 'done' | 'qr';
type UploadKey = 'idFront' | 'idBack' | 'selfie';
type Mode = 'camera' | 'qr';

interface UploadedFile {
  url: string;
  preview: string;
}

interface Props {
  token: string;
  api: string;
  locale: string;
  config?: Record<string, unknown>;
  onEvent: (name: string, detail: Record<string, unknown>) => void;
}

export function WidgetApp({ token: initialToken, api, locale, config, onEvent }: Props) {
  const [phase, setPhase] = useState<Phase>('intro');
  const [mode, setMode] = useState<Mode>('camera');
  const [sessionToken, setSessionToken] = useState(initialToken);

  const idData = (config?.idData as IdData | undefined) || undefined;
  const [creatingSession, setCreatingSession] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [uploads, setUploads] = useState<Record<UploadKey, UploadedFile | null>>({
    idFront: null,
    idBack: null,
    selfie: null,
  });
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [capturedPreviewUrl, setCapturedPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const fingerprintSentRef = useRef(false);
  const deviceFingerprintRef = useRef(collectDeviceFingerprint());
  const geolocationRef = useRef<GeolocationData | null>(null);

  const hasCameraApi = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

  const showError = useCallback((msg: string) => {
    let message = msg;
    if (message === 'Load failed' || message === 'Failed to fetch') {
      message = 'No se pudo conectar con el servidor. Verificá tu conexión a internet.';
    }
    setError(message);
    onEvent('kyc:error', { message, code: 'upload_failed' });
  }, [onEvent]);

  const createSession = useCallback(async (): Promise<string | null> => {
    // If we already have a token (passed directly), use it
    if (sessionToken) return sessionToken;
    if (!config) return null;

    setCreatingSession(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (config.apiKey) {
        headers['x-publishable-key'] = String(config.apiKey);
      } else if (config.token) {
        headers['Authorization'] = `Bearer ${String(config.token)}`;
      }

      const res = await fetch(`${api}/widget/sessions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          userId: config.userId,
          idData: config.idData || null,
          callbackUrl: config.callbackUrl || null,
          callbackSecret: config.callbackSecret || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Session creation failed' }));
        throw new Error((err as any).message || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setSessionToken(data.token);
      return data.token as string;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Session creation failed';
      showError(message);
      return null;
    } finally {
      setCreatingSession(false);
    }
  }, [sessionToken, config, api, showError]);

  const handleStart = useCallback(async () => {
    // Create session and collect geolocation in parallel
    const [token] = await Promise.all([
      createSession(),
      collectGeolocation().then((geo) => { geolocationRef.current = geo; }),
    ]);
    if (!token) return;

    if (mode === 'qr') {
      setPhase('qr');
    } else {
      setPhase('camera');
    }
  }, [mode, createSession]);

  const handleCapture = useCallback((blob: Blob, previewUrl: string) => {
    setCapturedBlob(blob);
    setCapturedPreviewUrl(previewUrl);
    setPhase('preview');
  }, []);

  const handleRetake = useCallback(() => {
    if (capturedPreviewUrl) URL.revokeObjectURL(capturedPreviewUrl);
    setCapturedBlob(null);
    setCapturedPreviewUrl(null);
    setPhase('camera');
  }, [capturedPreviewUrl]);

  const handleConfirm = useCallback(async () => {
    if (!capturedBlob || uploading) return;
    const step = STEPS[currentStep];
    if (!step) return;
    const key = step.key as UploadKey;

    setUploading(true);
    try {
      const url = await uploadFile(capturedBlob, key, sessionToken, api);
      const preview = capturedPreviewUrl ?? '';

      const newUploads = { ...uploads, [key]: { url, preview } };
      setUploads(newUploads);
      setCapturedBlob(null);
      setCapturedPreviewUrl(null);

      const uploaded = [newUploads.idFront, newUploads.idBack, newUploads.selfie].filter(Boolean).length;
      onEvent('kyc:step-completed', { step: key, uploaded, total: 3 });

      const allDone = newUploads.idFront && newUploads.idBack && newUploads.selfie;

      if (allDone) {
        await patchSession(sessionToken, api, {
          status: 'completed',
          idFrontUrl: newUploads.idFront!.url,
          idBackUrl: newUploads.idBack!.url,
          selfieUrl: newUploads.selfie!.url,
        });
        onEvent('kyc:completed', { sessionId: sessionToken });
        setPhase('done');
      } else {
        const patchBody: Record<string, unknown> = {
          status: 'uploading',
          [`${key}Url`]: url,
        };
        if (!fingerprintSentRef.current) {
          patchBody.deviceFingerprint = {
            ...deviceFingerprintRef.current,
            geolocation: geolocationRef.current,
          };
          fingerprintSentRef.current = true;
        }
        await patchSession(sessionToken, api, patchBody);
        setCurrentStep(s => s + 1);
        setPhase('intermediate');
      }
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : 'Error al subir la foto');
    } finally {
      setUploading(false);
    }
  }, [capturedBlob, capturedPreviewUrl, uploading, currentStep, uploads, sessionToken, api, showError, onEvent]);

  const handleContinue = useCallback(() => {
    setPhase('camera');
  }, []);

  const handleQrCompleted = useCallback(() => {
    onEvent('kyc:completed', { sessionId: sessionToken });
    setPhase('done');
  }, [onEvent, sessionToken]);

  const handleBackToIntro = useCallback(() => {
    setPhase('intro');
    setCurrentStep(0);
  }, []);

  const handleCameraError = useCallback((err: { message: string; code: string; data?: Record<string, unknown> }) => {
    onEvent('kyc:error', err);
  }, [onEvent]);

  const step = STEPS[currentStep];
  const prevStep = STEPS[currentStep - 1];

  const segmentedBtn = 'flex-1 py-2 text-sm font-medium text-center rounded-lg cursor-pointer border-none bg-transparent relative z-10 transition-colors duration-200';

  return (
    <div className="flex-1 flex flex-col" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {phase === 'intro' && (
        <div className="flex-1 flex flex-col justify-center px-6 py-8 max-w-[420px] mx-auto w-full">
          <h1 className="text-2xl font-bold mb-2">Verificación de Identidad</h1>
          <p className="text-gray-500 text-sm mb-6">
            Necesitamos verificar tu identidad. El proceso dura menos de un minuto.
          </p>

          {/* Mode selector with sliding indicator */}
          {hasCameraApi && (
            <div className="relative flex p-1 bg-gray-100 rounded-xl mb-4">
              {/* Sliding background */}
              <div
                className="absolute top-1 bottom-1 rounded-lg bg-white shadow-sm transition-all duration-300 ease-in-out"
                style={{
                  width: 'calc(50% - 4px)',
                  left: mode === 'camera' ? '4px' : 'calc(50% + 0px)',
                }}
              />
              <button
                className={`${segmentedBtn} ${mode === 'camera' ? 'text-gray-800' : 'text-gray-500'}`}
                onClick={() => setMode('camera')}
              >
                Usar cámara
              </button>
              <button
                className={`${segmentedBtn} ${mode === 'qr' ? 'text-gray-800' : 'text-gray-500'}`}
                onClick={() => setMode('qr')}
              >
                Escanear QR
              </button>
            </div>
          )}

          {/* Mode description */}
          <div className="text-xs text-gray-500 mb-6 min-h-[2.5rem]">
            {mode === 'qr' && 'Se generará un código QR para que completes la verificación desde tu celular.'}
            {mode === 'camera' && 'Vas a usar la cámara de este dispositivo para tomar las fotos del DNI y la selfie.'}
            {!hasCameraApi && 'No se detectó cámara. Se generará un código QR para verificar desde tu celular.'}
          </div>

          {/* Steps */}
          <ul className="list-none mb-8">
            {STEPS.map((s, i) => (
              <li
                key={s.key}
                className={`flex items-center gap-4 py-4${i < STEPS.length - 1 ? ' border-b border-gray-100' : ''}`}
              >
                <div className="w-9 h-9 rounded-full bg-primary-50 text-primary-400 flex items-center justify-center font-bold text-sm shrink-0">
                  {i + 1}
                </div>
                <div className="text-sm">
                  <strong className="block mb-0.5">{s.introTitle}</strong>
                  <span className="text-gray-500 text-xs">{s.introDesc}</span>
                </div>
              </li>
            ))}
          </ul>

          <button
            className="block w-full py-4 border-none rounded-xl text-base font-semibold cursor-pointer text-center bg-primary-400 text-white disabled:opacity-50"
            onClick={handleStart}
            disabled={creatingSession}
          >
            {creatingSession ? 'Iniciando...' : 'Comenzar'}
          </button>

          <p className="text-gray-400 text-[11px] text-center mt-4 leading-relaxed">
            Al continuar, se solicitará acceso a tu cámara y ubicación para verificar tu identidad.
            Tu ubicación se usa únicamente con fines de seguridad.
          </p>
        </div>
      )}

      {phase === 'camera' && step && (
        <CameraPhase
          step={step}
          stepIndex={currentStep}
          totalSteps={STEPS.length}
          onCapture={handleCapture}
          onBack={currentStep === 0 ? handleBackToIntro : undefined}
          idData={step.key === 'idFront' ? idData : undefined}
          onError={handleCameraError}
        />
      )}

      {phase === 'intermediate' && step && prevStep && (
        <IntermediatePhase
          prevStep={prevStep}
          nextStep={step}
          onContinue={handleContinue}
        />
      )}

      {phase === 'preview' && step && capturedPreviewUrl && capturedBlob && (
        <PreviewPhase
          step={step}
          blob={capturedBlob}
          previewUrl={capturedPreviewUrl}
          uploading={uploading}
          onConfirm={handleConfirm}
          onRetake={handleRetake}
        />
      )}

      {phase === 'qr' && (
        <QrFallback
          token={sessionToken}
          api={api}
          onCompleted={handleQrCompleted}
          onBack={handleBackToIntro}
        />
      )}

      {phase === 'done' && (
        <DonePhase />
      )}

      {error !== '' && (
        <ErrorToast message={error} onDismiss={() => setError('')} />
      )}
    </div>
  );
}
