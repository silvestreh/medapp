import { Group, ActionIcon, Tooltip } from '@mantine/core';
import { CaretLeftIcon, CaretRightIcon, GearIcon, CalendarIcon } from '@phosphor-icons/react';
import dayjs from 'dayjs';
import startCase from 'lodash/startCase';
import { useTranslation } from 'react-i18next';

import { styled } from '~/styled-system/jsx';
import { formatInLocale } from '~/utils';

interface HeaderProps {
  date: dayjs.Dayjs;
  locale?: string | null;
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
    // backgroundColor: '#FAFBFB',

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

export function Header({ date, locale, onPrevMonth, onNextMonth, onTodayClick, onSettingsClick }: HeaderProps) {
  const { t } = useTranslation();

  return (
    <HeaderContainer>
      <Title>{startCase(formatInLocale(date, 'MMMM YYYY', locale))}</Title>

      <Group align="center" gap="sm">
        <Tooltip label={t('appointments.today')} withArrow arrowSize={8}>
          <ActionIcon onClick={onTodayClick} size="lg">
            <CalendarIcon size={20} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label={t('common.settings')} withArrow arrowSize={8}>
          <ActionIcon onClick={onSettingsClick} size="lg">
            <GearIcon size={20} />
          </ActionIcon>
        </Tooltip>
        <Group align="center" gap={0}>
          <Tooltip label={t('appointments.previous_month')} withArrow arrowSize={8}>
            <ActionIcon
              onClick={onPrevMonth}
              size="lg"
              styles={{ root: { borderTopRightRadius: 0, borderBottomRightRadius: 0 } }}
            >
              <CaretLeftIcon size={20} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={t('appointments.next_month')} withArrow arrowSize={8}>
            <ActionIcon
              onClick={onNextMonth}
              size="lg"
              styles={{ root: { borderTopLeftRadius: 0, borderBottomLeftRadius: 0 } }}
            >
              <CaretRightIcon size={20} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
    </HeaderContainer>
  );
}
