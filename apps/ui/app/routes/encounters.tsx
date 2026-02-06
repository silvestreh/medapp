import { type LinksFunction, type MetaFunction } from '@remix-run/node';
import { Outlet } from '@remix-run/react';
import datesStyles from '@mantine/dates/styles.css?url';

export const links: LinksFunction = () => [{ rel: 'stylesheet', href: datesStyles }];

export const meta: MetaFunction = () => {
  return [{ title: 'MedApp / Encuentros' }];
};

export default function Encounters() {
  return <Outlet />;
}
