import { ActionIcon, Title, Text } from '@mantine/core';
import { ArrowLeft } from 'lucide-react';

import { styled } from '~/styled-system/jsx';

const TitleGroup = styled('div', {
  base: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    flex: 1,
    minWidth: 0,
  },
});

const TitleStack = styled('div', {
  base: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.125rem',
    minWidth: 0,
  },
});

interface ToolbarTitleProps {
  title: string;
  subTitle?: string;
  onBack?: () => void;
}

export function ToolbarTitle({ title, subTitle, onBack }: ToolbarTitleProps) {
  return (
    <TitleGroup maxW={{ base: 'calc(100vw - 11rem)', md: 'none' }}>
      {onBack && (
        <ActionIcon variant="subtle" color="gray" size="lg" onClick={onBack}>
          <ArrowLeft size={20} />
        </ActionIcon>
      )}
      {!subTitle && (
        <Title
          m={0}
          lh={1}
          fz={{ base: 'h3', md: 'h2' }}
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            letterSpacing: '-0.025em',
          }}
        >
          {title}
        </Title>
      )}
      {subTitle && (
        <TitleStack>
          <Title m={0} lh={1} fz={{ base: 'h4', md: 'h3' }}>
            {title}
          </Title>
          <Text c="dimmed" fz="sm" lh={1}>
            {subTitle}
          </Text>
        </TitleStack>
      )}
    </TitleGroup>
  );
}
