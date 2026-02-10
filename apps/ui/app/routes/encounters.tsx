import { type LinksFunction, type MetaFunction } from '@remix-run/node';
import { Outlet } from '@remix-run/react';
import '@mantine/dates/styles.css';

export const links: LinksFunction = () => [];

export const meta: MetaFunction = () => {
  return [{ title: 'MedApp / Encuentros' }];
};

export default function Encounters() {
  return <Outlet />;
}
