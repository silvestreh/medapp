import type { MetaFunction } from '@remix-run/node';
import { resources } from '~/i18n/i18n';

type RootLoaderData = { locale?: string };

/**
 * Extracts the locale from the root loader data available in MetaFunction matches.
 */
function getLocale(matches: Parameters<MetaFunction>[0]['matches']): keyof typeof resources {
  const rootMatch = matches.find((m) => m.id === 'root');
  const data = rootMatch?.data as RootLoaderData | undefined;
  const locale = data?.locale ?? 'es';
  return locale as keyof typeof resources;
}

/**
 * Returns a translated page title formatted as "MedApp / <title>".
 * Use inside `export const meta: MetaFunction` to get locale-aware titles.
 *
 * @example
 * export const meta: MetaFunction = ({ matches }) => {
 *   return [{ title: getPageTitle(matches, 'appointments') }];
 * };
 */
export function getPageTitle(
  matches: Parameters<MetaFunction>[0]['matches'],
  key: keyof (typeof resources)['es']['translation']['page_titles']
): string {
  const locale = getLocale(matches);
  const title = resources[locale].translation.page_titles[key];
  return `MedApp / ${title}`;
}
