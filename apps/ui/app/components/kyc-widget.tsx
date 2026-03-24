import { useCallback, useEffect, useRef } from 'react';

interface KycWidgetProps {
  apiKey: string;
  apiUrl: string;
  userId: string;
  idData: Record<string, unknown>;
  locale?: string;
  onCompleted: () => void;
  onError?: (err: { message: string; code?: string; data?: Record<string, unknown> }) => void;
}

export function KycWidget({ apiKey, apiUrl, userId, idData, locale = 'es', onCompleted, onError }: KycWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<{ destroy: () => void } | null>(null);
  const initedRef = useRef(false);

  const handleCompleted = useCallback(() => {
    onCompleted();
  }, [onCompleted]);

  const handleError = useCallback(
    (err: { message: string; code?: string; data?: Record<string, unknown> }) => {
      onError?.(err);
    },
    [onError]
  );

  useEffect(() => {
    if (initedRef.current || !containerRef.current) return;
    initedRef.current = true;

    const scriptUrl = import.meta.env.DEV ? `${apiUrl}/widget.js?t=${Date.now()}` : `${apiUrl}/widget.js`;

    const script = document.createElement('script');
    script.src = scriptUrl;
    script.async = true;
    script.onload = () => {
      const KycWidget = (window as any).KycWidget;

      if (!KycWidget || !containerRef.current) return;

      const instance = KycWidget.init({
        apiKey,
        api: apiUrl,
        userId,
        idData,
        container: containerRef.current,
        locale,
        onCompleted: handleCompleted,
        onError: handleError,
      });

      instanceRef.current = instance;
    };

    document.head.appendChild(script);

    return () => {
      instanceRef.current?.destroy();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={containerRef} style={{ minHeight: '500px' }} />;
}
