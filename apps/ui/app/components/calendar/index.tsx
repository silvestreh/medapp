import { memo, useMemo, useCallback, useEffect, useState } from 'react';
import { Grid } from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import startCase from 'lodash/startCase';
import dayjs, { Dayjs } from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import weekday from 'dayjs/plugin/weekday';
import localeData from 'dayjs/plugin/localeData';
import { useEventListener } from 'usehooks-ts';
import { useNavigate } from '@remix-run/react';
import 'dayjs/locale/es';

import { Header } from '~/components/calendar/header';
import { Day } from '~/components/calendar/day';
import { styled } from '~/stitches';

export type EventVariant = 'blue' | 'green' | 'pink' | 'yellow';

export interface CalendarEvent {
  id?: string;
  title: string;
  startDate: string;
  endDate: string;
  variant?: EventVariant;
  extra?: boolean;
  allDay?: boolean;
}

interface CalendarProps {
  events: CalendarEvent[];
  date: Dayjs | null;
  onNavigate: (date: Dayjs) => void;
  onChange: (date: Dayjs) => void;
  workDays: number[];
  selectedDate: Dayjs | null;
  medicId: string;
  onSettingsClick: () => void;
}

dayjs.extend(isBetween);
dayjs.extend(weekday);
dayjs.extend(localeData);
dayjs.locale('es');

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const MainContainer = styled('div', {
  minHeight: 'fit-content',
  zIndex: 1,

  '@sm': {
    position: 'sticky',
    top: '4.25em',
    boxShadow: '0 0 2px rgba(0, 0, 0, 0.1), 0 0.25em 0.5em rgba(0, 0, 0, 0.05)',
  },
  '@lg': {
    position: 'static',
    boxShadow: 'none',
  },
});

const WeekdayHeader = styled('div', {
  padding: '0.5em',
  fontWeight: 500,
  backgroundColor: 'var(--mantine-color-blue-0)',
  borderBottom: '1px solid var(--mantine-color-blue-1)',
  borderRight: '1px solid var(--mantine-color-blue-1)',
  fontSize: '0.875rem',

  '@lg': {
    fontSize: '1em',
  },

  variants: {
    isFirst: {
      true: {
        borderTopLeftRadius: 0,
      },
    },
    isLast: {
      true: {
        borderTopRightRadius: 0,
        borderRight: 'none',
      },
    },
  },
});

const GridContainer = styled('div', {
  borderTop: '1px solid var(--mantine-color-blue-1)',
  borderBottom: '1px solid var(--mantine-color-gray-1)',
});

function Calendar({
  events,
  date,
  onChange,
  onNavigate,
  workDays,
  selectedDate,
  medicId,
  onSettingsClick,
}: CalendarProps) {
  const currentDate = date || dayjs();
  const startOfMonth = currentDate.startOf('month');
  const daysToSubtract = (startOfMonth.day() + 6) % 7;
  const startOfCalendar = startOfMonth.subtract(daysToSubtract, 'day');
  const [focusedDayIndex, setFocusedDayIndex] = useState<number | null>(null);
  const [lastFocusedDayIndex, setLastFocusedDayIndex] = useState<number | null>(null);
  const navigate = useNavigate();

  const allDays = useMemo(() => {
    return Array.from({ length: 42 }, (_, i) => {
      const date = startOfCalendar.add(i, 'day');
      const dayEvents = events.filter(event => {
        const start = dayjs(event.startDate).startOf('day');
        const end = dayjs(event.endDate).startOf('day');
        return date.isBetween(start, end, 'day', '[]');
      });

      return {
        date,
        events: dayEvents,
        isCurrentMonth: date.month() === currentDate.month(),
      };
    });
  }, [startOfCalendar, events, currentDate]);

  const displayedWeeks = useMemo(() => {
    const weeks = [];
    for (let i = 0; i < 6; i++) {
      weeks.push(allDays.slice(i * 7, (i + 1) * 7));
    }
    return weeks.filter((week, index) => {
      if (index === 5) {
        return week.some(day => day.isCurrentMonth);
      }
      return true;
    });
  }, [allDays]);

  // Add position information to each day
  const daysWithPosition = displayedWeeks.map((week, weekIndex) =>
    week.map((day, dayIndex) => ({
      ...day,
      isLastRow: weekIndex === displayedWeeks.length - 1,
      isFirstRow: weekIndex === 0,
      isFirstInRow: dayIndex === 0,
      isLastInRow: dayIndex === 6,
    }))
  );

  const handlePrevMonth = useCallback(() => {
    onNavigate(currentDate.subtract(1, 'month'));
  }, [currentDate, onNavigate]);

  const handleNextMonth = useCallback(() => {
    onNavigate(currentDate.add(1, 'month'));
  }, [currentDate, onNavigate]);

  const handleTodayClick = useCallback(() => {
    onNavigate(dayjs());
  }, [onNavigate]);

  const handleDayClick = useCallback(
    (date: Dayjs) => {
      if (!workDays.includes(date.day())) {
        return showNotification({
          title: 'No disponible',
          message: `No atiende los días ${startCase(date.format('dddd'))}`,
          color: 'red',
        });
      }
      onChange(date);
    },
    [workDays, onChange]
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const maxIndex = allDays.length - 1;
      const isArrowKey = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key);
      const isCalendarKey = isArrowKey || event.key === 'Enter' || event.key === 'Escape';

      if (selectedDate) return;

      if (isCalendarKey) {
        event.preventDefault();
      }

      if (focusedDayIndex === null && isArrowKey) {
        setFocusedDayIndex(lastFocusedDayIndex ?? 0);
        return;
      }

      switch (event.key) {
        case 'ArrowUp':
          setFocusedDayIndex(prev => (prev !== null ? Math.max(prev - 7, 0) : prev));
          break;
        case 'ArrowDown':
          setFocusedDayIndex(prev => (prev !== null ? Math.min(prev + 7, maxIndex) : prev));
          break;
        case 'ArrowLeft':
          setFocusedDayIndex(prev => (prev !== null ? Math.max(prev - 1, 0) : prev));
          break;
        case 'ArrowRight':
          setFocusedDayIndex(prev => (prev !== null ? Math.min(prev + 1, maxIndex) : prev));
          break;
        case 'Enter':
          if (focusedDayIndex !== null) {
            const selectedDay = allDays[focusedDayIndex];
            handleDayClick(selectedDay.date);
            if (!workDays.includes(selectedDay.date.day())) return;
            navigate(`/appointments/${medicId}/${selectedDay.date.format('YYYY-MM-DD')}`, { preventScrollReset: true });
          }
          break;
        case 'Escape':
          setFocusedDayIndex(null);
          break;
        default:
          break;
      }
    },
    [focusedDayIndex, lastFocusedDayIndex, selectedDate, allDays, workDays, medicId, navigate, handleDayClick]
  );

  useEffect(() => {
    if (focusedDayIndex !== null) {
      setLastFocusedDayIndex(focusedDayIndex);
    }
  }, [focusedDayIndex]);

  useEventListener('keydown', handleKeyDown);

  return (
    <MainContainer>
      <Header
        date={currentDate}
        onPrevMonth={handlePrevMonth}
        onNextMonth={handleNextMonth}
        onTodayClick={handleTodayClick}
        onSettingsClick={onSettingsClick}
      />
      <GridContainer>
        <Grid columns={7} gutter={0} bg="var(--mantine-color-gray-3)">
          {WEEKDAYS.map((day, index) => (
            <Grid.Col key={day} span={1} pos="sticky" top={0}>
              <WeekdayHeader isFirst={index === 0} isLast={index === 6}>
                {day}
              </WeekdayHeader>
            </Grid.Col>
          ))}

          {daysWithPosition.flatMap((week, weekIndex) =>
            week.map((dayData, dayIndex) => (
              <Grid.Col key={`${weekIndex}-${dayIndex}`} span={1}>
                <Day
                  {...dayData}
                  onClick={handleDayClick}
                  workDays={workDays}
                  selectedDate={selectedDate}
                  medicId={medicId}
                  isFocused={focusedDayIndex === weekIndex * 7 + dayIndex}
                />
              </Grid.Col>
            ))
          )}
        </Grid>
      </GridContainer>
    </MainContainer>
  );
}

export default memo(Calendar);
