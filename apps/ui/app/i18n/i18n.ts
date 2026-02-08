import { es } from './locales/es';
import { en } from './locales/en';

export const resources = {
  es: { translation: es },
  en: { translation: en },
} as const;

export default {
  // This is the list of languages your application supports
  supportedLngs: ['es', 'en'],
  // This is the language you want to use in case
  // if the user language is not in the supportedLngs
  fallbackLng: 'es',
  // The default namespace of i18next is "translation", but you can change it here
  defaultNS: 'translation',
} as const;

// This is the type of our translation keys
export type TranslationKeys = typeof es;

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: {
      translation: TranslationKeys;
    };
  }
}
