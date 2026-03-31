import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import type { DocumentType } from '../../declarations';
import { getSteps } from '../../shared-client/steps';
import { uploadFile, patchSession } from '../../shared-client/api';
import { collectDeviceFingerprint, collectGeolocation } from '../../shared-client/utils';
import type { GeolocationData } from '../../shared-client/utils';
import { IntroPhase } from '../../shared-client/phases/intro-phase';
import { CameraPhase } from '../../shared-client/phases/camera-phase';
import { IntermediatePhase } from '../../shared-client/phases/intermediate-phase';
import { PreviewPhase } from '../../shared-client/phases/preview-phase';
import { DonePhase } from '../../shared-client/phases/done-phase';
import { ErrorToast } from '../../shared-client/components/error-toast';

type Phase = 'intro' | 'camera' | 'intermediate' | 'preview' | 'done';
type UploadKey = 'idFront' | 'idBack' | 'selfie';

interface UploadedFile {
  url: string;
  preview: string;
}

interface Props {
  token: string;
  api: string;
}

export function App({ token, api }: Props) {
  const [phase, setPhase] = useState<Phase>('intro');
  const [documentType, setDocumentType] = useState<DocumentType>('dni');
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

  const steps = useMemo(() => getSteps(documentType), [documentType]);

  const fingerprintSentRef = useRef(false);
  const deviceFingerprintRef = useRef(collectDeviceFingerprint());
  const geolocationRef = useRef<GeolocationData | null>(null);

  const showError = useCallback((msg: string) => {
    let message = msg;
    if (message === 'Load failed' || message === 'Failed to fetch') {
      message = 'No se pudo conectar con el servidor. Verificá tu conexión a internet.';
    }
    setError(message);
  }, []);

  const handleDocumentTypeChange = useCallback((type: DocumentType) => {
    setDocumentType(type);
  }, []);

  const handleStart = useCallback(() => {
    collectGeolocation().then((geo) => {
      geolocationRef.current = geo;
    });
    setPhase('camera');
  }, []);

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
      const url = await uploadFile(capturedBlob, key, token, api);
      const preview = capturedPreviewUrl ?? '';

      const newUploads = { ...uploads, [key]: { url, preview } };
      setUploads(newUploads);
      setCapturedBlob(null);
      setCapturedPreviewUrl(null);

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
        await patchSession(token, api, patchBody);
        setPhase('done');
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
        await patchSession(token, api, patchBody);
        setCurrentStep(s => s + 1);
        setPhase('intermediate');
      }
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : 'Error al subir la foto');
    } finally {
      setUploading(false);
    }
  }, [capturedBlob, capturedPreviewUrl, uploading, currentStep, uploads, token, api, showError, steps, documentType]);

  const handleContinue = useCallback(() => {
    setPhase('camera');
  }, []);

  const step = steps[currentStep];
  const prevStep = steps[currentStep - 1];

  return (
    <div className="flex-1 flex flex-col">
      {phase === 'intro' && (
        <IntroPhase
          documentType={documentType}
          onDocumentTypeChange={handleDocumentTypeChange}
          onStart={handleStart}
        />
      )}

      {phase === 'camera' && step && (
        <CameraPhase
          step={step}
          stepIndex={currentStep}
          totalSteps={steps.length}
          onCapture={handleCapture}
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

      {phase === 'done' && (
        <DonePhase />
      )}

      {error !== '' && (
        <ErrorToast message={error} onDismiss={() => setError('')} />
      )}
    </div>
  );
}
