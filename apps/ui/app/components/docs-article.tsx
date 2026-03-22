import type { PropsWithChildren } from 'react';
import { css } from '~/styled-system/css';

const articleStyles = css({
  flex: 1,
  minWidth: 0,
  '& h1': {
    fontSize: '2rem',
    fontWeight: 700,
    lineHeight: 1.3,
    marginBottom: '1rem',
    paddingBottom: '0.5rem',
    borderBottom: '1px solid var(--mantine-color-gray-2)',
  },
  '& h2': {
    fontSize: '1.5rem',
    fontWeight: 600,
    lineHeight: 1.3,
    marginTop: '2rem',
    marginBottom: '0.75rem',
  },
  '& h3': {
    fontSize: '1.25rem',
    fontWeight: 600,
    lineHeight: 1.4,
    marginTop: '1.5rem',
    marginBottom: '0.5rem',
  },
  '& p': {
    fontSize: '1rem',
    lineHeight: 1.7,
    marginBottom: '1rem',
    color: 'var(--mantine-color-gray-8)',
  },
  '& a': {
    color: 'var(--mantine-color-blue-6)',
    textDecoration: 'none',
    _hover: {
      textDecoration: 'underline',
    },
  },
  '& code': {
    backgroundColor: 'var(--mantine-color-gray-1)',
    borderRadius: '4px',
    padding: '0.15em 0.4em',
    fontSize: '0.9em',
    fontFamily: 'var(--mantine-font-family-monospace)',
  },
  '& pre': {
    backgroundColor: 'var(--mantine-color-gray-0)',
    borderRadius: '8px',
    padding: '1rem',
    overflowX: 'auto',
    marginBottom: '1rem',
    border: '1px solid var(--mantine-color-gray-2)',
    '& code': {
      backgroundColor: 'transparent',
      padding: 0,
      borderRadius: 0,
    },
  },
  '& ul, & ol': {
    paddingLeft: '1.5rem',
    marginBottom: '1rem',
    '& li': {
      lineHeight: 1.7,
      marginBottom: '0.25rem',
    },
  },
  '& table': {
    width: '100%',
    borderCollapse: 'collapse',
    marginBottom: '1rem',
    fontSize: '0.9rem',
    '& th, & td': {
      padding: '0.5rem 0.75rem',
      border: '1px solid var(--mantine-color-gray-2)',
      textAlign: 'left',
    },
    '& th': {
      backgroundColor: 'var(--mantine-color-gray-0)',
      fontWeight: 600,
    },
  },
  '& blockquote': {
    borderLeft: '3px solid var(--mantine-color-blue-4)',
    backgroundColor: 'var(--mantine-color-gray-0)',
    margin: '0 0 1rem 0',
    padding: '0.75rem 1rem',
    '& p': {
      m: 0,
    },
  },
  '& img': {
    maxWidth: '100%',
    borderRadius: '8px',
  },
  '& hr': {
    border: 'none',
    borderTop: '1px solid var(--mantine-color-gray-2)',
    margin: '2rem 0',
  },
  '& strong': {
    fontWeight: 600,
  },
});

export function DocsArticle({ children }: PropsWithChildren) {
  return <article className={articleStyles}>{children}</article>;
}
