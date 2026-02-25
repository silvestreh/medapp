import { useEffect, useCallback } from 'react';
import { useBlocker } from '@remix-run/react';

interface UseUnsavedGuardOptions {
  isDirty: boolean;
  onSave?: () => void;
}

interface UseUnsavedGuardReturn {
  blocker: ReturnType<typeof useBlocker>;
  handleDiscard: () => void;
  handleCancel: () => void;
  handleSaveAndLeave: () => void;
}

export function useUnsavedGuard({ isDirty, onSave }: UseUnsavedGuardOptions): UseUnsavedGuardReturn {
  const blocker = useBlocker(isDirty);

  useEffect(() => {
    if (!isDirty) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const handleDiscard = useCallback(() => {
    if (blocker.state === 'blocked') {
      blocker.proceed();
    }
  }, [blocker]);

  const handleCancel = useCallback(() => {
    if (blocker.state === 'blocked') {
      blocker.reset();
    }
  }, [blocker]);

  const handleSaveAndLeave = useCallback(() => {
    if (blocker.state === 'blocked') {
      onSave?.();
      blocker.proceed();
    }
  }, [blocker, onSave]);

  return { blocker, handleDiscard, handleCancel, handleSaveAndLeave };
}
