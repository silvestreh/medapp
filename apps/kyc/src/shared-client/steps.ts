import type { DocumentType } from '../declarations';

export interface StepDef {
  key: string;
  title: string;
  introTitle: string;
  introDesc: string;
  cameraHint: string;
  cameraHintAuto: string;
  nextTitle: string | null;
  nextDesc: string | null;
  facing: string;
  autoDetect: string;
}

export const DNI_STEPS: StepDef[] = [
  {
    key: 'idFront',
    title: 'Frente del DNI',
    introTitle: 'Frente del DNI',
    introDesc: 'Foto del frente donde se vea tu cara y el código de barras',
    cameraHint: 'Encuadrá el frente del DNI completo (cara y código de barras)',
    cameraHintAuto: 'Buscando código de barras...',
    nextTitle: 'Dorso del DNI',
    nextDesc: 'Ahora necesitamos una foto del dorso de tu DNI.',
    facing: 'environment',
    autoDetect: 'barcode',
  },
  {
    key: 'idBack',
    title: 'Dorso del DNI',
    introTitle: 'Dorso del DNI',
    introDesc: 'Foto del dorso donde se vea la información',
    cameraHint: 'Encuadrá el dorso del DNI',
    cameraHintAuto: '',
    nextTitle: 'Video selfie',
    nextDesc: 'Por último, necesitamos verificar tu identidad mirando a la cámara.',
    facing: 'environment',
    autoDetect: 'text',
  },
  {
    key: 'selfie',
    title: 'Video selfie',
    introTitle: 'Video selfie',
    introDesc: 'Verificación mirando a la cámara (sin anteojos)',
    cameraHint: 'Mirá a la cámara',
    cameraHintAuto: 'Estamos verificando tus documentos...',
    nextTitle: null,
    nextDesc: null,
    facing: 'user',
    autoDetect: 'face',
  },
];

export const PASSPORT_STEPS: StepDef[] = [
  {
    key: 'idFront',
    title: 'Pasaporte',
    introTitle: 'Página de datos del pasaporte',
    introDesc: 'Foto de la página con tu foto y datos personales (zona MRZ)',
    cameraHint: 'Encuadrá la página de datos del pasaporte',
    cameraHintAuto: 'Buscando zona MRZ...',
    nextTitle: 'Video selfie',
    nextDesc: 'Ahora necesitamos verificar tu identidad mirando a la cámara.',
    facing: 'environment',
    autoDetect: 'mrz',
  },
  {
    key: 'selfie',
    title: 'Video selfie',
    introTitle: 'Video selfie',
    introDesc: 'Verificación mirando a la cámara (sin anteojos)',
    cameraHint: 'Mirá a la cámara',
    cameraHintAuto: 'Estamos verificando tus documentos...',
    nextTitle: null,
    nextDesc: null,
    facing: 'user',
    autoDetect: 'face',
  },
];

/** Backward-compat export — defaults to DNI steps */
export const STEPS = DNI_STEPS;

export function getSteps(documentType: DocumentType | null | undefined): StepDef[] {
  return documentType === 'passport' ? PASSPORT_STEPS : DNI_STEPS;
}
