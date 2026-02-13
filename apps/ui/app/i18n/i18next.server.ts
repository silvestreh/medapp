import { RemixI18Next } from 'remix-i18next/server';
import { createCookie } from '@remix-run/node';
import i18n, { resources } from './i18n';

export const localeCookie = createCookie('lng', {
  path: '/',
  sameSite: 'lax',
  maxAge: 60 * 60 * 24 * 365,
});

const i18next = new RemixI18Next({
  detection: {
    supportedLanguages: i18n.supportedLngs.slice(),
    fallbackLanguage: i18n.fallbackLng,
    cookie: localeCookie,
    order: ['searchParams', 'cookie'],
  },
  i18next: {
    ...i18n,
    resources,
  },
});

export default i18next;
