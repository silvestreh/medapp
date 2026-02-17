import { type LinksFunction, type MetaFunction } from '@remix-run/node';
import { Outlet } from '@remix-run/react';
import '@mantine/dates/styles.css';

import { getPageTitle } from '~/utils/meta';

export const links: LinksFunction = () => [];

export const meta: MetaFunction = ({ matches }) => {
  return [{ title: getPageTitle(matches, 'encounters') }];
};

export default function Encounters() {
  return <Outlet />;
}
