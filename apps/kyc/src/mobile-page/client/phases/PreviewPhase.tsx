import { useCallback, useEffect, useState } from 'react';
import { StepDef } from '../../steps';
import { getBarcodeDetector } from '../detection';

type PreviewValidation = '' | 'validating' | 'valid' | 'invalid';

interface Props {
  step: StepDef;
  blob: Blob;
  previewUrl: string;
  uploading: boolean;
  onConfirm: () => void;
  onRetake: () => void;
}

export function PreviewPhase({ step, blob, previewUrl, uploading, onConfirm, onRetake }: Props) {
  const [previewValidation, setPreviewValidation] = useState<PreviewValidation>('');

  useEffect(() => {
    if (step.key !== 'idFront') {
      setPreviewValidation('valid');
      return;
    }

    setPreviewValidation('validating');

    getBarcodeDetector()
      .then(detector => {
        const img = new Image();
        img.onload = () => {
          detector
            .detect(img)
            .then(results => {
              const found = results && results.some(r => r.rawValue && r.rawValue.length > 50);
              setPreviewValidation(found ? 'valid' : 'invalid');
            })
            .catch(() => setPreviewValidation('valid'));
        };
        img.onerror = () => setPreviewValidation('valid');
        img.src = previewUrl;
      })
      .catch(() => setPreviewValidation('valid'));
  }, [step.key, previewUrl]);

  const handleConfirm = useCallback(() => {
    onConfirm();
  }, [onConfirm]);

  const handleRetake = useCallback(() => {
    onRetake();
  }, [onRetake]);

  const canConfirm = !uploading && previewValidation !== 'validating' && previewValidation !== 'invalid';
  const isSelfie = step.key === 'selfie';

  let confirmLabel = 'Confirmar';
  if (uploading) confirmLabel = 'Subiendo...';
  else if (previewValidation === 'validating') confirmLabel = 'Verificando...';

  return (
    <div
      className="flex-1 flex flex-col bg-black"
      style={{ paddingTop: 'calc(60px + env(safe-area-inset-top))' }}
    >
      {uploading && (
        <div
          className="fixed left-0 right-0 text-center text-white text-sm py-2 bg-primary-400/80 z-10"
          style={{ top: 'calc(60px + env(safe-area-inset-top))' }}
        >
          Subiendo foto...
        </div>
      )}

      {previewValidation === 'invalid' && (
        <div
          className="fixed left-0 right-0 text-center text-white text-sm py-3 px-5 bg-red-600 z-10 leading-snug"
          style={{ top: 'calc(60px + env(safe-area-inset-top))' }}
        >
          No se detectó el código de barras del DNI. Volvé a tomar la foto asegurándote de que se vea el frente
          completo del documento.
        </div>
      )}

      {isSelfie && (
        <video
          src={previewUrl}
          autoPlay
          loop
          muted
          playsInline
          className="flex-1 w-full object-contain"
        />
      )}

      {!isSelfie && (
        <img src={previewUrl} alt="Preview" className="flex-1 w-full object-contain" />
      )}

      <div
        className="fixed top-0 left-0 right-0 flex gap-3 z-10 bg-black/85"
        style={{ padding: 'calc(1rem + env(safe-area-inset-top)) 1.25rem 1rem' }}
      >
        <button
          className="flex-1 py-3.5 rounded-xl border-none text-base font-semibold cursor-pointer bg-white/15 text-white"
          onClick={handleRetake}
          disabled={uploading}
        >
          Volver a tomar
        </button>

        {previewValidation === 'invalid' && (
          <button
            className="flex-1 py-3.5 rounded-xl border-none text-base font-semibold cursor-pointer bg-red-600 text-white"
            onClick={handleRetake}
          >
            Reintentar
          </button>
        )}

        {previewValidation !== 'invalid' && (
          <button
            className="flex-1 py-3.5 rounded-xl border-none text-base font-semibold cursor-pointer bg-primary-400 text-white disabled:bg-gray-600 disabled:text-gray-400"
            onClick={handleConfirm}
            disabled={!canConfirm}
          >
            {confirmLabel}
          </button>
        )}
      </div>
    </div>
  );
}
