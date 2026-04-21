import { styled } from '~/styled-system/jsx';

export const PanelContainer = styled('div', {
  base: {
    borderLeft: '1px solid var(--mantine-color-gray-2)',
    backgroundColor: 'white',
    overflowY: 'auto',
    padding: 'var(--mantine-spacing-md)',
    height: '100%',
  },
});

export const SectionTitle = styled('div', {
  base: {
    fontSize: 'var(--mantine-font-size-xs)',
    fontWeight: 700,
    color: 'var(--mantine-color-gray-5)',
    textTransform: 'uppercase',
    marginBottom: 'var(--mantine-spacing-xs)',
  },
});

export const flexOneStyle: React.CSSProperties = { flex: 1 };
