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
    cameraHintAuto: 'Se captura automáticamente al detectar el código',
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
    nextTitle: 'Selfie',
    nextDesc: 'Por último, necesitamos una selfie tuya mirando a la cámara.',
    facing: 'environment',
    autoDetect: 'none',
  },
  {
    key: 'selfie',
    title: 'Selfie',
    introTitle: 'Selfie',
    introDesc: 'Una foto tuya mirando a la cámara',
    cameraHint: 'Mirá a la cámara',
    cameraHintAuto: 'Se captura automáticamente al detectar tu cara',
    nextTitle: null,
    nextDesc: null,
    facing: 'user',
    autoDetect: 'face',
  },
];
