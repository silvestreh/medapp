import { useCallback } from 'react';
import { StepDef } from '../steps';

interface Props {
  step: StepDef;
  blob: Blob;
  previewUrl: string;
  uploading: boolean;
  onConfirm: () => void;
  onRetake: () => void;
}

export function PreviewPhase({ step, blob, previewUrl, uploading, onConfirm, onRetake }: Props) {
  const handleConfirm = useCallback(() => {
    onConfirm();
  }, [onConfirm]);

  const handleRetake = useCallback(() => {
    onRetake();
  }, [onRetake]);

  const isSelfie = step.key === 'selfie';

  return (
    <div className="flex-1 flex flex-col">
      {/* Preview */}
      <div className="relative">
        {isSelfie && (
          <video
            src={previewUrl}
            autoPlay
            loop
            muted
            playsInline
            className="block w-full"
          />
        )}

        {!isSelfie && (
          <img src={previewUrl} alt="Preview" className="block w-full" />
        )}

        {uploading && (
          <div className="absolute bottom-0 left-0 right-0 text-center text-white text-sm py-2 bg-primary-400/80">
            Subiendo foto...
          </div>
        )}
      </div>

      {/* Buttons */}
      <div className="flex gap-3 p-4">
        <button
          className="flex-1 py-3.5 rounded-xl border border-gray-200 text-base font-semibold cursor-pointer bg-white text-gray-700 disabled:opacity-50"
          onClick={handleRetake}
          disabled={uploading}
        >
          Volver a tomar
        </button>

        <button
          className="flex-1 py-3.5 rounded-xl border-none text-base font-semibold cursor-pointer bg-primary-400 text-white disabled:bg-gray-300 disabled:text-gray-500"
          onClick={handleConfirm}
          disabled={uploading}
        >
          {uploading ? 'Subiendo...' : 'Confirmar'}
        </button>
      </div>
    </div>
  );
}
