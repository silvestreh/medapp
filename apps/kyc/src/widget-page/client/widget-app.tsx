import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import type { DocumentType } from '../../declarations';
import { getSteps, STEPS } from '../../shared-client/steps';
import type { IdData } from '../../shared-client/barcode-validation';
import { uploadFile, patchSession } from '../../shared-client/api';
import { collectDeviceFingerprint, collectGeolocation } from '../../shared-client/utils';
import type { GeolocationData } from '../../shared-client/utils';
import { CameraPhase } from '../../shared-client/phases/camera-phase';
import { IntermediatePhase } from '../../shared-client/phases/intermediate-phase';
import { PreviewPhase } from '../../shared-client/phases/preview-phase';
import { ErrorToast } from '../../shared-client/components/error-toast';
import { QrFallback } from './qr-fallback';

type Phase = 'intro' | 'camera' | 'intermediate' | 'preview' | 'done' | 'qr' | 'selfie_retry' | 'selfie_retry_camera' | 'selfie_retry_preview' | 'processing';
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
  const [phase, setPhase] = useState<Phase | 'loading'>('loading');
  const [mode, setMode] = useState<Mode>('camera');
  const [documentType, setDocumentType] = useState<DocumentType>('dni');
  const [sessionToken, setSessionToken] = useState(initialToken);

  const idData = (config?.idData as IdData | undefined) || undefined;
  const [creatingSession, setCreatingSession] = useState(false);

  const [idDataChanged, setIdDataChanged] = useState(false);

  const steps = useMemo(() => getSteps(documentType), [documentType]);
  const selfieStep = useMemo(() => steps.find(s => s.key === 'selfie')!, [steps]);

  // Check if user already has a verified identity on mount
  useEffect(() => {
    const userId = config?.userId;
    if (!userId || !api) { setPhase('intro'); return; }

    const headers: Record<string, string> = {};
    if (config?.apiKey) headers['x-publishable-key'] = String(config.apiKey);
    else if (config?.token) headers['Authorization'] = `Bearer ${String(config.token)}`;

    fetch(`${api}/widget/user-verification-status?userId=${encodeURIComponent(String(userId))}`, { headers })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.status === 'verified') {
          // Compare idData from the verification with what was passed during init
          if (idData && data.idData) {
            const changed =
              (idData.dniNumber && data.idData.dniNumber && idData.dniNumber !== data.idData.dniNumber) ||
              (idData.firstName && data.idData.firstName && idData.firstName.toLowerCase() !== data.idData.firstName.toLowerCase()) ||
              (idData.lastName && data.idData.lastName && idData.lastName.toLowerCase() !== data.idData.lastName.toLowerCase());
            if (changed) {
              setIdDataChanged(true);
              setPhase('intro');
              return;
            }
          }
          setPhase('done');
        } else {
          setPhase('intro');
        }
      })
      .catch(() => setPhase('intro'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
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

  const handleDocumentTypeChange = useCallback((type: DocumentType) => {
    setDocumentType(type);
  }, []);

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
          documentType,
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
  }, [sessionToken, config, api, showError, documentType]);

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
    const step = steps[currentStep];
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

      const uploaded = Object.values(newUploads).filter(Boolean).length;
      onEvent('kyc:step-completed', { step: key, uploaded, total: steps.length });

      const isPassport = documentType === 'passport';
      const allDone = isPassport
        ? newUploads.idFront && newUploads.selfie
        : newUploads.idFront && newUploads.idBack && newUploads.selfie;

      if (allDone) {
        const patchBody: Record<string, unknown> = {
          status: 'completed',
          idFrontUrl: newUploads.idFront!.url,
          selfieUrl: newUploads.selfie!.url,
          documentType,
        };
        if (!isPassport) {
          patchBody.idBackUrl = newUploads.idBack!.url;
        }
        await patchSession(sessionToken, api, patchBody);
        setPhase('processing');
      } else {
        const patchBody: Record<string, unknown> = {
          status: 'uploading',
          [`${key}Url`]: url,
          documentType,
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
  }, [capturedBlob, capturedPreviewUrl, uploading, currentStep, uploads, sessionToken, api, showError, onEvent, steps, documentType]);

  const handleContinue = useCallback(() => {
    setPhase('camera');
  }, []);

  const handleQrCompleted = useCallback(() => {
    setPhase('processing');
  }, []);

  const handleBackToIntro = useCallback(() => {
    setPhase('intro');
    setCurrentStep(0);
  }, []);

  const handleCameraError = useCallback((err: { message: string; code: string; data?: Record<string, unknown> }) => {
    onEvent('kyc:error', err);
  }, [onEvent]);

  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [selfieRetryBlob, setSelfieRetryBlob] = useState<Blob | null>(null);
  const [selfieRetryPreview, setSelfieRetryPreview] = useState<string | null>(null);

  // Poll verification status after all photos submitted
  useEffect(() => {
    if (phase !== 'processing') return;
    if (!sessionToken) return;

    const poll = setInterval(async () => {
      try {
        const res = await fetch(`${api}/widget/verification-status`, {
          headers: { 'x-session-token': sessionToken },
        });
        if (!res.ok) return;
        const data = await res.json();

        if (data.verificationId) setVerificationId(data.verificationId);

        if (data.status === 'verified') {
          clearInterval(poll);
          onEvent('kyc:completed', { sessionId: sessionToken });
          setPhase('done');
        } else if (data.status === 'selfie_retry') {
          clearInterval(poll);
          setPhase('selfie_retry');
        } else if (data.status === 'rejected') {
          clearInterval(poll);
          onEvent('kyc:error', { message: data.rejectionReason || 'Verification rejected', code: 'rejected' });
          setPhase('done');
        }
      } catch { /* continue polling */ }
    }, 3000);

    return () => clearInterval(poll);
  }, [phase, sessionToken, api, onEvent]);

  const handleSelfieRetryCapture = useCallback((blob: Blob, previewUrl: string) => {
    setSelfieRetryBlob(blob);
    setSelfieRetryPreview(previewUrl);
    setPhase('selfie_retry_preview');
  }, []);

  const handleSelfieRetryRetake = useCallback(() => {
    if (selfieRetryPreview) URL.revokeObjectURL(selfieRetryPreview);
    setSelfieRetryBlob(null);
    setSelfieRetryPreview(null);
    setPhase('selfie_retry_camera');
  }, [selfieRetryPreview]);

  const handleSelfieRetryConfirm = useCallback(async () => {
    if (!selfieRetryBlob || !verificationId || !sessionToken || uploading) return;
    setUploading(true);
    try {
      // Upload new selfie
      const url = await uploadFile(selfieRetryBlob, 'selfie', sessionToken, api);

      // Resubmit for face comparison
      await fetch(`${api}/widget/resubmit-selfie/${verificationId}`, {
        method: 'POST',
        headers: { 'x-session-token': sessionToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ selfieUrl: url }),
      });

      setSelfieRetryBlob(null);
      setSelfieRetryPreview(null);
      setPhase('processing');
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : 'Error re-submitting selfie');
    } finally {
      setUploading(false);
    }
  }, [selfieRetryBlob, verificationId, sessionToken, uploading, api, showError]);

  const step = steps[currentStep];
  const prevStep = steps[currentStep - 1];

  const segmentedBtn = 'flex-1 py-2 text-sm font-medium text-center rounded-lg cursor-pointer border-none bg-transparent relative z-10 transition-colors duration-200';

  return (
    <div className="flex-1 flex flex-col" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {phase === 'loading' && (
        <div className="flex-1 flex flex-col justify-center items-center py-8">
          <div className="w-8 h-8 border-3 border-gray-200 border-t-primary-500 rounded-full animate-spin" />
        </div>
      )}

      {phase === 'intro' && (
        <div className="flex-1 flex flex-col justify-center px-6 py-8 max-w-[420px] mx-auto w-full">
          {idDataChanged && (
            <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-800">
              Tus datos personales cambiaron desde la última verificación. Necesitás verificar tu identidad nuevamente.
            </div>
          )}
          <h1 className="text-2xl font-bold mb-2">Verificación de Identidad</h1>
          <p className="text-gray-500 text-sm mb-6">
            Necesitamos verificar tu identidad. El proceso dura menos de un minuto.
          </p>

          {/* Document type selector */}
          <div className="relative flex p-1 bg-gray-100 rounded-xl mb-4">
            <div
              className="absolute top-1 bottom-1 rounded-lg bg-white shadow-sm transition-all duration-300 ease-in-out"
              style={{
                width: 'calc(50% - 4px)',
                left: documentType === 'dni' ? '4px' : 'calc(50% + 0px)',
              }}
            />
            <button
              className={`${segmentedBtn} ${documentType === 'dni' ? 'text-gray-800' : 'text-gray-500'}`}
              onClick={() => handleDocumentTypeChange('dni')}
            >
              DNI
            </button>
            <button
              className={`${segmentedBtn} ${documentType === 'passport' ? 'text-gray-800' : 'text-gray-500'}`}
              onClick={() => handleDocumentTypeChange('passport')}
            >
              Pasaporte
            </button>
          </div>

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
            {mode === 'camera' && 'Vas a usar la cámara de este dispositivo para tomar las fotos y la selfie.'}
            {!hasCameraApi && 'No se detectó cámara. Se generará un código QR para verificar desde tu celular.'}
          </div>

          {/* Steps */}
          <ul className="list-none mb-8">
            {steps.map((s, i) => (
              <li
                key={s.key}
                className={`flex items-center gap-4 py-4${i < steps.length - 1 ? ' border-b border-gray-100' : ''}`}
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
          totalSteps={steps.length}
          onCapture={handleCapture}
          onBack={currentStep === 0 ? handleBackToIntro : undefined}
          idData={step.key === 'idFront' && documentType === 'dni' ? idData : undefined}
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

      {phase === 'processing' && (
        <div className="flex-1 flex flex-col justify-center items-center px-6 py-8 text-center">
          <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin mb-4" />
          <p className="text-gray-500 text-sm">Verificando tu identidad...</p>
        </div>
      )}

      {phase === 'selfie_retry' && (
        <div className="flex-1 flex flex-col justify-center items-center px-6 py-8 text-center max-w-[420px] mx-auto w-full">
          <div className="w-14 h-14 rounded-full bg-orange-100 text-orange-500 flex items-center justify-center text-2xl mb-4">
            !
          </div>
          <h2 className="text-xl font-bold mb-2">Se detectaron anteojos</h2>
          <p className="text-gray-500 text-sm mb-6">
            Para completar la verificación, necesitamos una selfie sin anteojos.
            Por favor, retirá los anteojos y volvé a tomar la selfie.
          </p>
          <button
            className="block w-full py-4 border-none rounded-xl text-base font-semibold cursor-pointer text-center bg-primary-400 text-white"
            onClick={() => setPhase('selfie_retry_camera')}
          >
            Re-tomar selfie
          </button>
        </div>
      )}

      {phase === 'selfie_retry_camera' && (
        <CameraPhase
          step={selfieStep}
          stepIndex={steps.length - 1}
          totalSteps={steps.length}
          onCapture={handleSelfieRetryCapture}
          onBack={() => setPhase('selfie_retry')}
        />
      )}

      {phase === 'selfie_retry_preview' && selfieRetryPreview && selfieRetryBlob && (
        <PreviewPhase
          step={selfieStep}
          blob={selfieRetryBlob}
          previewUrl={selfieRetryPreview}
          uploading={uploading}
          onConfirm={handleSelfieRetryConfirm}
          onRetake={handleSelfieRetryRetake}
        />
      )}

      {phase === 'done' && (
        <div className="flex-1 flex flex-col justify-center items-center px-6 py-8 text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-3xl mb-4">
            ✓
          </div>
          <h2 className="text-xl font-bold mb-2">Identidad verificada</h2>
          <p className="text-gray-500 text-sm">
            Tu identidad ha sido verificada correctamente.
          </p>
        </div>
      )}

      {error !== '' && (
        <ErrorToast message={error} onDismiss={() => setError('')} />
      )}
    </div>
  );
}
