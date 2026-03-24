import { useCallback } from 'react';
import { StepDef } from '../steps';

interface Props {
  prevStep: StepDef;
  nextStep: StepDef;
  onContinue: () => void;
}

export function IntermediatePhase({ prevStep, nextStep, onContinue }: Props) {
  const handleContinue = useCallback(() => {
    onContinue();
  }, [onContinue]);

  return (
    <div className="flex-1 flex flex-col justify-center items-center px-6 py-8 pb-[calc(2rem+env(safe-area-inset-bottom))] text-center max-w-[420px] mx-auto w-full">
      <div className="w-14 h-14 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-3xl mb-5">
        ✓
      </div>
      <h2 className="text-xl font-bold mb-2">{prevStep.title} lista</h2>
      <p className="text-gray-500 text-sm mb-1">Siguiente paso</p>
      <p className="text-lg font-semibold mb-2">{nextStep.title}</p>
      <p className="text-gray-500 text-sm mb-8 leading-relaxed">{prevStep.nextDesc}</p>
      <button
        className="block w-full py-4 border-none rounded-xl text-base font-semibold cursor-pointer text-center bg-primary-400 text-white"
        onClick={handleContinue}
      >
        Continuar
      </button>
    </div>
  );
}
