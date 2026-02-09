import { RemixI18Next } from 'remix-i18next/server';
import i18n, { resources } from './i18n';

const i18next = new RemixI18Next({
  detection: {
    supportedLanguages: i18n.supportedLngs.slice(),
    fallbackLanguage: i18n.fallbackLng,
    order: ['searchParams', 'cookie'],
  },
  i18next: {
    ...i18n,
    resources,
  },
});

export default i18next;
