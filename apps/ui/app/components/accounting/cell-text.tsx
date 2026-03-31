import { styled } from '~/styled-system/jsx';

export const CellText = styled('span', {
  base: {
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    display: 'block',
    padding: 'var(--mantine-spacing-xs)',
    fontSize: 'var(--mantine-font-size-sm)',
  },
});
