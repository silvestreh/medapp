import { Group, ActionIcon, Tooltip } from '@mantine/core';
import { ChevronLeft, ChevronRight, Settings, Calendar } from 'lucide-react';
import dayjs from 'dayjs';
import startCase from 'lodash/startCase';

import { styled } from '~/styled-system/jsx';

interface HeaderProps {
  date: dayjs.Dayjs;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onTodayClick: () => void;
  onSettingsClick: () => void;
}

const HeaderContainer = styled('div', {
  base: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FAFBFB',

    sm: {
      padding: '1em',
    },
    md: {
      padding: '2em 2em 1em',
    },
  },
});

const Title = styled('h1', {
  base: {
    fontSize: '1.5rem',
    lineHeight: 1,
    fontWeight: 700,
    flex: 1,
    margin: 0,

    md: {
      fontSize: '2rem',
    },

    lg: {
      fontSize: '2.25rem',
    },
  },
});

export function Header({ date, onPrevMonth, onNextMonth, onTodayClick, onSettingsClick }: HeaderProps) {
  return (
    <HeaderContainer>
      <Title>{startCase(date.format('MMMM YYYY'))}</Title>

      <Group align="center" gap="sm">
        <Tooltip label="Hoy" withArrow arrowSize={8}>
          <ActionIcon onClick={onTodayClick} size="lg">
            <Calendar size={20} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Configuración" withArrow arrowSize={8}>
          <ActionIcon onClick={onSettingsClick} size="lg">
            <Settings size={20} />
          </ActionIcon>
        </Tooltip>
        <Group align="center" gap={0}>
          <Tooltip label="Mes anterior" withArrow arrowSize={8}>
            <ActionIcon
              onClick={onPrevMonth}
              size="lg"
              styles={{ root: { borderTopRightRadius: 0, borderBottomRightRadius: 0 } }}
            >
              <ChevronLeft size={20} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Mes siguiente" withArrow arrowSize={8}>
            <ActionIcon
              onClick={onNextMonth}
              size="lg"
              styles={{ root: { borderTopLeftRadius: 0, borderBottomLeftRadius: 0 } }}
            >
              <ChevronRight size={20} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
    </HeaderContainer>
  );
}
