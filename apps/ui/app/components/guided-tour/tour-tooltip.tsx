import React from 'react';
import { Button, Group, Text } from '@mantine/core';
import type { TooltipRenderProps } from 'react-joyride';
import { useTranslation } from 'react-i18next';
import { styled } from '~/styled-system/jsx';

const Container = styled('div', {
  base: {
    bg: 'white',
    borderRadius: 'md',
    boxShadow: 'lg',
    p: '5',
    maxWidth: 'calc(100vw - 2rem)',
    width: '360px',
  },
});

const TourTooltip: React.FC<TooltipRenderProps> = ({
  continuous,
  index,
  step,
  size,
  backProps,
  primaryProps,
  skipProps,
  closeProps,
  isLastStep,
}) => {
  const { t } = useTranslation();

  return (
    <Container>
      {step.title && (
        <Text fw={600} size="md" mb="xs">
          {step.title}
        </Text>
      )}
      <Text size="sm" c="gray.7" mb="md">
        {step.content}
      </Text>
      <Group justify="space-between" align="center">
        <Text size="xs" c="dimmed">
          {t('tour.step_of', { current: index + 1, total: size })}
        </Text>
        <Group gap="xs">
          {!isLastStep && (
            <Button variant="subtle" size="xs" color="gray" {...skipProps}>
              {t('tour.skip')}
            </Button>
          )}
          {index > 0 && (
            <Button variant="default" size="xs" {...backProps}>
              {t('tour.back')}
            </Button>
          )}
          {continuous && (
            <Button size="xs" {...primaryProps}>
              {isLastStep ? t('tour.done') : t('tour.next')}
            </Button>
          )}
          {!continuous && (
            <Button size="xs" {...closeProps}>
              {t('tour.done')}
            </Button>
          )}
        </Group>
      </Group>
    </Container>
  );
};

export default TourTooltip;
