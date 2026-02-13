import { RemixI18Next } from 'remix-i18next/server';
import { createCookie } from '@remix-run/node';
import i18n, { resources } from './i18n';

export const localeCookie = createCookie('lng', {
  path: '/',
  sameSite: 'lax',
  maxAge: 60 * 60 * 24 * 365,
});

function isSupportedLocale(locale: string | null): locale is (typeof i18n.supportedLngs)[number] {
  return !!locale && i18n.supportedLngs.includes(locale as any);
}

export async function resolveLocale(request: Request): Promise<(typeof i18n.supportedLngs)[number]> {
  const url = new URL(request.url);
  const localeFromQuery = url.searchParams.get('lng');

  if (isSupportedLocale(localeFromQuery)) {
    return localeFromQuery;
  }

  const localeFromCookie = await localeCookie.parse(request.headers.get('Cookie'));
  if (isSupportedLocale(localeFromCookie)) {
    return localeFromCookie;
  }

  return i18n.fallbackLng;
}

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
