import { useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import SignaturePad from 'signature_pad';
import { Button, Group, Paper } from '@mantine/core';

interface SignatureCanvasProps {
  onSave: (base64: string) => void;
  onCancel: () => void;
}

export function SignatureCanvas({ onSave, onCancel }: SignatureCanvasProps) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePad | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(ratio, ratio);

    padRef.current = new SignaturePad(canvas, {
      penColor: '#1a1a2e',
      backgroundColor: '#ffffff',
    });

    return () => {
      padRef.current?.off();
      padRef.current = null;
    };
  }, []);

  const handleClear = useCallback(() => {
    padRef.current?.clear();
  }, []);

  const handleSave = useCallback(() => {
    if (!padRef.current || padRef.current.isEmpty()) return;
    const dataUrl = padRef.current.toDataURL('image/png');
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
    onSave(base64);
  }, [onSave]);

  return (
    <Paper withBorder p="sm" mt="xs">
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: 160,
          display: 'block',
          borderRadius: 4,
          border: '1px solid var(--mantine-color-gray-3)',
          cursor: 'crosshair',
        }}
      />
      <Group gap="xs" mt="xs" justify="flex-end">
        <Button variant="subtle" size="xs" onClick={handleClear}>
          {t('recetario.signature_clear')}
        </Button>
        <Button variant="subtle" size="xs" onClick={onCancel}>
          {t('recetario.signature_cancel')}
        </Button>
        <Button variant="light" size="xs" onClick={handleSave}>
          {t('recetario.signature_save')}
        </Button>
      </Group>
    </Paper>
  );
}
