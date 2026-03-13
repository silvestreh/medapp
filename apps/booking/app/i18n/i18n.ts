import { es } from './locales/es';
import { en } from './locales/en';

export const resources = {
  es: { translation: es },
  en: { translation: en },
} as const;

export default {
  supportedLngs: ['es', 'en'],
  fallbackLng: 'es',
  lng: 'es',
  defaultNS: 'translation',
} as const;

export type TranslationKeys = typeof es;

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: {
      translation: TranslationKeys;
    };
  }
}
