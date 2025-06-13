import { Text } from '@mantine/core';
import { Link } from '@remix-run/react';
import dayjs from 'dayjs';
import { useMediaQuery } from '@mantine/hooks';
import { useEffect, useRef } from 'react';

import { CalendarEvent } from '~/components/calendar';
import { Event } from '~/components/calendar/event';
import { styled, media } from '~/stitches';

interface DayProps {
  date: dayjs.Dayjs;
  events: CalendarEvent[];
  onClick: (date: dayjs.Dayjs) => void;
  isCurrentMonth: boolean;
  isLastRow?: boolean;
  isFirstRow?: boolean;
  isFirstInRow?: boolean;
  isLastInRow?: boolean;
  workDays: number[];
  selectedDate: dayjs.Dayjs | null;
  medicId: string;
  isFocused: boolean;
}

const DayCell = styled(Link, {
  height: '100%',
  cursor: 'pointer',
  display: 'flex',
  flexDirection: 'column',
  border: '0.5px solid var(--mantine-color-gray-1)',
  position: 'relative',
  textDecoration: 'none',

  '&::before': {
    content: '',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
    transition: 'opacity 250ms ease-in-out',
    zIndex: 0,
  },

  '> *': {
    position: 'relative',
    zIndex: 1,
  },

  '&:hover': {
    backgroundColor: 'var(--mantine-color-blue-0)',
  },

  '@lg': {
    minHeight: '10em',
  },

  variants: {
    isCurrentMonth: {
      true: {
        backgroundColor: 'white',
      },
      false: {
        backgroundColor: 'var(--mantine-color-gray-0)',
        backgroundImage:
          'linear-gradient(45deg, var(--mantine-color-gray-1) 5.56%, var(--mantine-color-gray-0) 5.56%, var(--mantine-color-gray-0) 50%, var(--mantine-color-gray-1) 50%, var(--mantine-color-gray-1) 55.56%, var(--mantine-color-gray-0) 55.56%, var(--mantine-color-gray-0) 100%)',
        backgroundSize: '9.00px 9.00px',

        '&[data-work-day="true"]:hover': {
          backgroundColor: 'var(--mantine-color-gray-0)',
        },
      },
    },
    isLastRow: {
      true: {
        borderBottom: 'none',
        '&[data-first="true"]': {
          borderBottomLeftRadius: 0,
        },
        '&[data-last="true"]': {
          borderBottomRightRadius: 0,
        },
      },
    },
    isFirstRow: {
      true: {
        borderTop: 'none',
      },
    },
    isWorkDay: {
      true: {
        backgroundColor: 'white',
      },
      false: {
        cursor: 'not-allowed',
        '&[data-current-month="true"]:hover': {
          backgroundColor: 'white',
        },
        '&[data-current-month="true"]::before': {
          opacity: 1,
          backgroundImage:
            'linear-gradient(45deg, var(--mantine-color-red-1) 5.56%, transparent 5.56%, transparent 50%, var(--mantine-color-red-1) 50%, var(--mantine-color-red-1) 55.56%, transparent 55.56%, transparent 100%)',
          backgroundSize: '9.00px 9.00px',
        },
      },
    },
    isSelected: {
      true: {
        backgroundColor: 'var(--mantine-color-blue-1)',
        boxShadow: '0 0 0 1px var(--mantine-color-blue-3), inset 0 0 0 1px var(--mantine-color-blue-3)',
        borderColor: 'var(--mantine-color-blue-3)',
        position: 'relative',
        zIndex: 1,
        borderRadius: '0.125em',

        '&:hover': {
          backgroundColor: 'var(--mantine-color-blue-1)',
        },
      },
    },
    isFocused: {
      true: {
        outline: '2px solid var(--mantine-color-blue-2)',
        borderRadius: '0.125em',
        position: 'relative',
        zIndex: 1,
      },
      false: {
        outline: 'none',
      },
    },
  },

  compoundVariants: [
    {
      isFocused: true,
      isWorkDay: false,
      css: {
        outline: '2px solid var(--mantine-color-red-2)',
      },
    },
  ],
});

const EventsContainer = styled('div', {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  padding: '0.125em 0.5em 0.5em',
  gap: '0.25em',
  overflowX: 'hidden',
  overflowY: 'auto',
  maxHeight: '9.5em',
  scrollbarColor: 'rgba(0, 0, 0, 0.25) #f0f0f0',
  scrollbarWidth: 'thin',

  '&::-webkit-scrollbar': {
    width: '12px',
    height: '12px',
  },
  '&::-webkit-scrollbar-track': {
    backgroundColor: '#f0f0f0',
    borderRadius: '10px',
  },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: '10px',
  },
  '&::-webkit-scrollbar-thumb:hover': {
    backgroundColor: '#555',
  },
});

export function Day({
  date,
  events,
  onClick,
  isCurrentMonth,
  isFirstRow,
  isLastRow,
  isFirstInRow,
  isLastInRow,
  workDays,
  selectedDate,
  medicId,
  isFocused,
}: DayProps) {
  const isTablet = useMediaQuery(media.lg);
  const isToday = date.isSame(dayjs(), 'day');
  const isWorkDay = workDays.length > 0 ? workDays.includes(date.day()) : true;
  const isSelected = selectedDate?.isSame(date, 'day');
  const dayRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (isFocused && dayRef.current) {
      dayRef.current.focus();
    }
  }, [isFocused]);

  const getDayColor = () => {
    if (!isWorkDay && isToday) return 'red';
    if (isToday) return 'blue';
    if (isCurrentMonth) return 'dark';
    return 'gray';
  };

  const sortedEvents = events
    .filter(event => {
      const startDate = dayjs(event.startDate);
      const endDate = dayjs(event.endDate);
      const duration = endDate.diff(startDate, 'hour');
      return duration <= 24 && startDate.isSame(endDate, 'day');
    })
    .sort((a, b) => {
      // Sort by start date first
      const startDiff = dayjs(a.startDate).valueOf() - dayjs(b.startDate).valueOf();
      if (startDiff !== 0) return startDiff;

      // If start dates are equal, sort by duration (end - start)
      const aDuration = dayjs(a.endDate).diff(dayjs(a.startDate));
      const bDuration = dayjs(b.endDate).diff(dayjs(b.startDate));
      return bDuration - aDuration; // Longer events first
    });

  const multiDayEvents = events.filter(event => {
    const startDate = dayjs(event.startDate);
    const endDate = dayjs(event.endDate);
    const duration = endDate.diff(startDate, 'hour');
    return duration > 24 || !startDate.isSame(endDate, 'day');
  });

  return (
    <DayCell
      ref={dayRef}
      tabIndex={0}
      to={isWorkDay ? `/appointments/${medicId}/${date.format('YYYY-MM-DD')}` : '#'}
      isCurrentMonth={isCurrentMonth}
      isLastRow={isLastRow}
      isFirstRow={isFirstRow}
      isWorkDay={isWorkDay}
      isSelected={isSelected}
      onClick={() => onClick(date)}
      data-first={isFirstInRow}
      data-last={isLastInRow}
      data-work-day={workDays.includes(date.day())}
      data-current-month={isCurrentMonth}
      prefetch="intent"
      isFocused={isFocused}
      preventScrollReset={isTablet}
    >
      <Text size="sm" m="0.5em 0.75em" c={getDayColor()} fw={isToday ? 700 : 400} style={{ flexShrink: 0 }}>
        {date.date()}
      </Text>

      {multiDayEvents.map(event => (
        <Event
          key={event.id}
          event={event}
          variant={event.variant}
          date={date}
          isFirstInRow={isFirstInRow}
          isLastInRow={isLastInRow}
        />
      ))}
      <EventsContainer>
        {sortedEvents.map(event => (
          <Event
            key={event.id}
            event={event}
            variant={event.variant}
            date={date}
            isFirstInRow={isFirstInRow}
            isLastInRow={isLastInRow}
          />
        ))}
      </EventsContainer>
    </DayCell>
  );
}
