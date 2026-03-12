import React, { useEffect } from 'react';

interface Props {
  message: string;
  onDismiss: () => void;
}

export function ErrorToast({ message, onDismiss }: Props) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [message, onDismiss]);

  return (
    <div className="fixed bottom-6 left-4 right-4 bg-red-600 text-white py-3 px-4 rounded-xl text-sm text-center z-[100] animate-[slideUp_0.3s_ease]">
      {message}
    </div>
  );
}
