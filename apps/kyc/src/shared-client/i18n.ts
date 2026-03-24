type TranslationKey =
  | 'intro.title'
  | 'intro.start'
  | 'camera.step_of'
  | 'camera.take_photo'
  | 'camera.upload_from_gallery'
  | 'camera.camera_required'
  | 'camera.verifying'
  | 'camera.ready'
  | 'camera.keep_looking'
  | 'camera.remove_glasses'
  | 'preview.confirm'
  | 'preview.retake'
  | 'done.title'
  | 'done.description'
  | 'qr.title'
  | 'qr.description'
  | 'qr.waiting'
  | 'qr.uploading'
  | 'qr.photos_uploaded'
  | 'qr.completed'
  | 'qr.back'
  | 'qr.error'
  | 'error.connection'
  | 'error.upload'
  | 'widget.use_qr'
  | 'widget.use_camera';

type Translations = Record<TranslationKey, string>;

const es: Translations = {
  'intro.title': 'Verificación de identidad',
  'intro.start': 'Comenzar',
  'camera.step_of': 'Paso {current} de {total}',
  'camera.take_photo': 'Tomar foto',
  'camera.upload_from_gallery': 'Subir desde galería',
  'camera.camera_required': 'Se necesita acceso a la cámara para tomar la selfie. Por favor habilitá el acceso a la cámara en los ajustes de tu navegador.',
  'camera.verifying': 'Verificando...',
  'camera.ready': 'Listo ✓',
  'camera.keep_looking': 'Mantené la mirada en la cámara',
  'camera.remove_glasses': 'Quitá los anteojos para continuar',
  'preview.confirm': 'Confirmar',
  'preview.retake': 'Volver a tomar',
  'done.title': '¡Listo!',
  'done.description': 'Tu verificación fue enviada correctamente.',
  'qr.title': 'Verificá tu identidad',
  'qr.description': 'Escaneá el código QR con tu celular para continuar con la verificación.',
  'qr.waiting': 'Esperando...',
  'qr.uploading': 'Subiendo fotos...',
  'qr.photos_uploaded': 'fotos subidas',
  'qr.completed': 'Verificación completada ✓',
  'qr.back': 'Volver',
  'qr.error': 'Error generando código QR',
  'error.connection': 'No se pudo conectar con el servidor. Verificá tu conexión a internet.',
  'error.upload': 'Error al subir la foto',
  'widget.use_qr': 'Usar QR con el celular',
  'widget.use_camera': 'Usar cámara de este dispositivo',
};

const en: Translations = {
  'intro.title': 'Identity Verification',
  'intro.start': 'Start',
  'camera.step_of': 'Step {current} of {total}',
  'camera.take_photo': 'Take photo',
  'camera.upload_from_gallery': 'Upload from gallery',
  'camera.camera_required': 'Camera access is needed to take a selfie. Please enable camera access in your browser settings.',
  'camera.verifying': 'Verifying...',
  'camera.ready': 'Ready ✓',
  'camera.keep_looking': 'Keep looking at the camera',
  'camera.remove_glasses': 'Remove glasses to continue',
  'preview.confirm': 'Confirm',
  'preview.retake': 'Retake',
  'done.title': 'Done!',
  'done.description': 'Your verification was submitted successfully.',
  'qr.title': 'Verify your identity',
  'qr.description': 'Scan the QR code with your phone to continue with the verification.',
  'qr.waiting': 'Waiting...',
  'qr.uploading': 'Uploading photos...',
  'qr.photos_uploaded': 'photos uploaded',
  'qr.completed': 'Verification completed ✓',
  'qr.back': 'Back',
  'qr.error': 'Error generating QR code',
  'error.connection': 'Could not connect to the server. Check your internet connection.',
  'error.upload': 'Error uploading photo',
  'widget.use_qr': 'Use QR with phone',
  'widget.use_camera': 'Use this device\'s camera',
};

const locales: Record<string, Translations> = { es, en };

let currentLocale = 'es';

export function setLocale(locale: string): void {
  currentLocale = locale in locales ? locale : 'es';
}

export function t(key: TranslationKey, params?: Record<string, string | number>): string {
  const translations = locales[currentLocale] || locales.es;
  let text = translations[key] || key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(`{${k}}`, String(v));
    }
  }
  return text;
}
