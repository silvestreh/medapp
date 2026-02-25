import { type LinksFunction, type MetaFunction } from '@remix-run/node';
import { Outlet } from '@remix-run/react';
import '@mantine/dates/styles.css';
import '@mantine/charts/styles.css';

import { getPageTitle } from '~/utils/meta';

export const links: LinksFunction = () => [];

export const meta: MetaFunction = ({ matches }) => {
  return [{ title: getPageTitle(matches, 'stats') }];
};

export default function Stats() {
  return <Outlet />;
}
