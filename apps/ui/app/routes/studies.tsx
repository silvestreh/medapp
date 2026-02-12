import { type LinksFunction, type MetaFunction } from '@remix-run/node';
import { Outlet } from '@remix-run/react';
import '@mantine/dates/styles.css';

export const links: LinksFunction = () => [];

export const meta: MetaFunction = () => {
  return [{ title: 'MedApp / Estudios' }];
};

export default function Studies() {
  return <Outlet />;
}
