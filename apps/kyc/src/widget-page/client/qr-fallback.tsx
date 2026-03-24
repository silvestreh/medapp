import React, { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';

interface SessionStatus {
  status: 'waiting' | 'uploading' | 'completed' | 'expired';
  idFrontUrl: string | null;
  idBackUrl: string | null;
  selfieUrl: string | null;
}

interface Props {
  token: string;
  api: string;
  onCompleted: () => void;
  onBack: () => void;
}

const POLL_INTERVAL_MS = 3000;

export function QrFallback({ token, api, onCompleted, onBack }: Props) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<SessionStatus['status']>('waiting');
  const [uploadedCount, setUploadedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Generate QR code
  useEffect(() => {
    const verifyUrl = `${api}/verify/${token}`;
    QRCode.toDataURL(verifyUrl, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 280,
    }).then(setQrDataUrl).catch(() => setError('Error generando código QR'));
  }, [api, token]);

  // Poll session status
  const pollStatus = useCallback(async () => {
    try {
      const res = await fetch(`${api}/widget/session-status`, {
        headers: { 'x-session-token': token },
      });
      if (!res.ok) return;
      const data: SessionStatus = await res.json();
      setStatus(data.status);

      const count = [data.idFrontUrl, data.idBackUrl, data.selfieUrl].filter(Boolean).length;
      setUploadedCount(count);

      if (data.status === 'completed') {
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
        onCompleted();
      }
    } catch {
      // Silently continue polling
    }
  }, [api, token, onCompleted]);

  useEffect(() => {
    pollRef.current = setInterval(pollStatus, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [pollStatus]);

  return (
    <div className="flex-1 flex flex-col justify-center items-center px-6 py-8 text-center max-w-[420px] mx-auto w-full">
      <h2 className="text-xl font-bold mb-2">Verificá tu identidad</h2>
      <p className="text-gray-500 text-sm mb-6">
        Escaneá el código QR con tu celular para continuar con la verificación.
      </p>

      {error && (
        <p className="text-red-500 text-sm mb-4">{error}</p>
      )}

      {qrDataUrl && (
        <img
          src={qrDataUrl}
          alt="QR Code"
          className="w-[280px] h-[280px] mb-6 rounded-lg"
        />
      )}

      {status === 'waiting' && (
        <div className="py-2 px-5 rounded-3xl text-sm font-semibold bg-gray-100 text-gray-600">
          Esperando...
        </div>
      )}

      {status === 'uploading' && (
        <div className="flex flex-col items-center gap-2">
          <div className="py-2 px-5 rounded-3xl text-sm font-semibold bg-blue-100 text-blue-700">
            Subiendo fotos...
          </div>
          <p className="text-xs text-gray-500">{uploadedCount}/3 fotos subidas</p>
        </div>
      )}

      {status === 'completed' && (
        <div className="py-2 px-5 rounded-3xl text-sm font-semibold bg-green-100 text-green-700">
          Verificación completada ✓
        </div>
      )}

      <button
        className="mt-6 bg-transparent border-none text-primary-500 text-sm cursor-pointer underline"
        onClick={onBack}
      >
        Volver
      </button>
    </div>
  );
}
