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

export const STEPS: StepDef[] = [
  {
    key: 'idFront',
    title: 'Frente del DNI',
    introTitle: 'Frente del DNI',
    introDesc: 'Foto del frente donde se vea tu cara y el código de barras',
    cameraHint: 'Encuadrá el frente del DNI',
    cameraHintAuto: 'Estamos verificando tus documentos...',
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
    cameraHint: 'Encuadrá el dorso del DNI y tocá el botón',
    cameraHintAuto: '',
    nextTitle: 'Video selfie',
    nextDesc: 'Por último, necesitamos verificar tu identidad mirando a la cámara.',
    facing: 'environment',
    autoDetect: 'none',
  },
  {
    key: 'selfie',
    title: 'Video selfie',
    introTitle: 'Video selfie',
    introDesc: 'Verificación mirando a la cámara',
    cameraHint: 'Mirá a la cámara',
    cameraHintAuto: 'Estamos verificando tus documentos...',
    nextTitle: null,
    nextDesc: null,
    facing: 'user',
    autoDetect: 'face',
  },
];
