import { useCallback } from 'react';
import { StepDef } from '../steps';

interface Props {
  steps: StepDef[];
  onStart: () => void;
}

export function IntroPhase({ steps, onStart }: Props) {
  const handleStart = useCallback(() => {
    onStart();
  }, [onStart]);

  return (
    <div className="flex-1 flex flex-col justify-center px-6 py-8 pb-[calc(2rem+env(safe-area-inset-bottom))] max-w-[420px] mx-auto w-full">
      <h1 className="text-2xl font-bold mb-2">Verificación de Identidad</h1>
      <p className="text-gray-500 text-sm mb-8">
        Necesitamos verificar tu identidad. El proceso dura menos de un minuto.
      </p>
      <ul className="list-none mb-10">
        {steps.map((step, i) => (
          <li
            key={step.key}
            className={`flex items-center gap-4 py-4${i < steps.length - 1 ? ' border-b border-gray-100' : ''}`}
          >
            <div className="w-9 h-9 rounded-full bg-primary-50 text-primary-400 flex items-center justify-center font-bold text-sm shrink-0">
              {i + 1}
            </div>
            <div className="text-sm">
              <strong className="block mb-0.5">{step.introTitle}</strong>
              <span className="text-gray-500 text-xs">{step.introDesc}</span>
            </div>
          </li>
        ))}
      </ul>
      <button
        className="block w-full py-4 border-none rounded-xl text-base font-semibold cursor-pointer text-center bg-primary-400 text-white"
        onClick={handleStart}
      >
        Comenzar
      </button>
    </div>
  );
}
