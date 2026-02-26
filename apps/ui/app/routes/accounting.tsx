import { type LinksFunction, type MetaFunction } from '@remix-run/node';
import { Outlet } from '@remix-run/react';
import '@mantine/dates/styles.css';
import '@mantine/charts/styles.css';
import '@fortune-sheet/react/dist/index.css';

import { getPageTitle } from '~/utils/meta';

export const links: LinksFunction = () => [];

export const meta: MetaFunction = ({ matches }) => {
  return [{ title: getPageTitle(matches, 'accounting') }];
};

export default function Accounting() {
  return <Outlet />;
}
