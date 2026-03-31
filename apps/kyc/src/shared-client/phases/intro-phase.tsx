import { useCallback, useEffect, useState } from 'react';
import type { DocumentType } from '../../declarations';
import { getSteps } from '../steps';

type CountryOrigin = 'AR' | 'other';

interface Props {
  documentType: DocumentType;
  onDocumentTypeChange: (type: DocumentType) => void;
  onStart: () => void;
  api?: string;
}

export function IntroPhase({ documentType, onDocumentTypeChange, onStart, api }: Props) {
  const [countryOrigin, setCountryOrigin] = useState<CountryOrigin | null>(null);
  const steps = getSteps(documentType);

  // Auto-detect country on mount
  useEffect(() => {
    if (!api) return;
    fetch(`${api}/detect-country`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.countryCode) return;
        const origin: CountryOrigin = data.countryCode === 'AR' ? 'AR' : 'other';
        setCountryOrigin(origin);
        if (origin === 'other') {
          onDocumentTypeChange('passport');
        }
      })
      .catch(() => {});
  }, [api]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStart = useCallback(() => {
    onStart();
  }, [onStart]);

  const handleSelectCountry = useCallback((origin: CountryOrigin) => {
    setCountryOrigin(origin);
    if (origin === 'other') {
      onDocumentTypeChange('passport');
    } else {
      onDocumentTypeChange('dni');
    }
  }, [onDocumentTypeChange]);

  const handleSelectDni = useCallback(() => {
    onDocumentTypeChange('dni');
  }, [onDocumentTypeChange]);

  const handleSelectPassport = useCallback(() => {
    onDocumentTypeChange('passport');
  }, [onDocumentTypeChange]);

  const showDocumentTypeToggle = countryOrigin === 'AR';

  const segmentedBtn = 'flex-1 py-2 text-sm font-medium text-center rounded-lg cursor-pointer border-none bg-transparent relative z-10 transition-colors duration-200';

  return (
    <div className="flex-1 flex flex-col justify-center px-6 py-8 pb-[calc(2rem+env(safe-area-inset-bottom))] max-w-[420px] mx-auto w-full">
      <h1 className="text-2xl font-bold mb-2">Verificación de Identidad</h1>
      <p className="text-gray-500 text-sm mb-8">
        Necesitamos verificar tu identidad. El proceso dura menos de un minuto.
      </p>

      {/* Country origin selector */}
      <label className="text-xs text-gray-500 mb-1.5 block">País de origen</label>
      <div className="relative flex p-1 bg-gray-100 rounded-xl mb-4">
        <div
          className="absolute top-1 bottom-1 rounded-lg bg-white shadow-sm transition-all duration-300 ease-in-out"
          style={{
            width: 'calc(50% - 4px)',
            left: countryOrigin !== 'other' ? '4px' : 'calc(50% + 0px)',
          }}
        />
        <button
          className={`${segmentedBtn} ${countryOrigin !== 'other' ? 'text-gray-800' : 'text-gray-500'}`}
          onClick={() => handleSelectCountry('AR')}
        >
          Argentina
        </button>
        <button
          className={`${segmentedBtn} ${countryOrigin === 'other' ? 'text-gray-800' : 'text-gray-500'}`}
          onClick={() => handleSelectCountry('other')}
        >
          Otro país
        </button>
      </div>

      {/* Document type selector — only for Argentina */}
      {showDocumentTypeToggle && (
        <>
          <label className="text-xs text-gray-500 mb-1.5 block">Tipo de documento</label>
          <div className="relative flex p-1 bg-gray-100 rounded-xl mb-6">
            <div
              className="absolute top-1 bottom-1 rounded-lg bg-white shadow-sm transition-all duration-300 ease-in-out"
              style={{
                width: 'calc(50% - 4px)',
                left: documentType === 'dni' ? '4px' : 'calc(50% + 0px)',
              }}
            />
            <button
              className={`${segmentedBtn} ${documentType === 'dni' ? 'text-gray-800' : 'text-gray-500'}`}
              onClick={handleSelectDni}
            >
              DNI
            </button>
            <button
              className={`${segmentedBtn} ${documentType === 'passport' ? 'text-gray-800' : 'text-gray-500'}`}
              onClick={handleSelectPassport}
            >
              Pasaporte
            </button>
          </div>
        </>
      )}

      {!showDocumentTypeToggle && (
        <div className="mb-6" />
      )}

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
