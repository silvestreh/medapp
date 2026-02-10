import dayjs from 'dayjs';
import { useMemo } from 'react';
import { styled } from '~/styled-system/jsx';

import { CalendarEvent, EventVariant } from '~/components/calendar';

interface EventProps {
  event: CalendarEvent;
  variant?: EventVariant;
  date: dayjs.Dayjs;
  isFirstInRow?: boolean;
  isLastInRow?: boolean;
  style?: React.CSSProperties;
}

export const EventBox = styled('div', {
  base: {
    alignItems: 'center',
    borderRadius: '0.5em',
    display: 'none',
    height: '1.5em',
    flexShrink: 0,
    fontSize: '12px',
    gap: '0.25em',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: 'var(--mantine-color-gray-8)',

    '&::before': {
      content: '""',
      display: 'block',
      width: '0.5em',
      height: '0.5em',
      borderRadius: '50%',
      flexShrink: 0,
      marginRight: '0.25em',
    },

    lg: {
      display: 'flex',
    },
  },

  variants: {
    variant: {
      blue: {
        '&:not([data-all-day="true"])::before': {
          backgroundColor: '#238BE6',
        },
        '&[data-all-day="true"]': {
          backgroundColor: '#238BE6',
          color: 'white',
        },
      },
      green: {
        '&:not([data-all-day="true"])::before': {
          backgroundColor: '#82C91E',
        },
        '&[data-all-day="true"]': {
          backgroundColor: '#82C91E',
          color: 'white',
        },
      },
      pink: {
        '&:not([data-all-day="true"])::before': {
          backgroundColor: '#E64880',
        },
        '&[data-all-day="true"]': {
          backgroundColor: '#E64880',
          color: 'white',
        },
      },
      yellow: {
        '&:not([data-all-day="true"])::before': {
          backgroundColor: '#FAB004',
        },
        '&[data-all-day="true"]': {
          backgroundColor: '#FAB004',
          color: 'white',
        },
      },
    },
    isFirstInRow: {
      true: {
        maskImage: 'linear-gradient(to right, transparent, white 2em)',
      },
    },
    isLastInRow: {
      true: {
        maskImage: 'linear-gradient(to left, transparent, white 2em)',
      },
    },
    isMultiDay: {
      true: {
        marginLeft: '-1em',
      },
    },
  },

  defaultVariants: {
    variant: 'blue',
  },
});

const Time = styled('span', {
  base: {
    padding: '1px 4px',
    height: '100%',
    fontFamily: 'ui-monospace, monospace',
    color: 'var(--mantine-color-gray-5)',
  },
});

const EventTitle = styled('span', {
  base: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    flexGrow: 1,
  },
});

export function Event({ event, date, isFirstInRow, isLastInRow, style }: EventProps) {
  const startDate = useMemo(() => dayjs(event.startDate), [event.startDate]);
  const endDate = useMemo(() => dayjs(event.endDate), [event.endDate]);
  const isFirstDay = date.isSame(startDate, 'day');
  const isLastDay = date.isSame(endDate, 'day');
  const isMultiDay = !startDate.isSame(endDate, 'day');

  return (
    <EventBox
      variant={event.variant}
      isFirstInRow={isMultiDay && isFirstInRow}
      isLastInRow={isMultiDay && isLastInRow && !isLastDay}
      isMultiDay={isMultiDay}
      data-all-day={event.allDay || isMultiDay}
      style={{
        ...style,
        borderRadius: isMultiDay
          ? `${isFirstDay ? '4px' : '0'} ${isLastDay ? '4px' : '0'} ${isLastDay ? '4px' : '0'} ${isFirstDay ? '4px' : '0'}`
          : '4px',
        marginLeft: isFirstDay && isMultiDay ? '0.5em' : -1,
        marginRight: isLastDay && isMultiDay ? '0.5em' : -1,
      }}
    >
      {isFirstDay && <EventTitle>{event.title}</EventTitle>}
      {isMultiDay && isFirstInRow && <EventTitle style={{ paddingLeft: '2em' }}>{event.title} (continúa)</EventTitle>}
      {!isMultiDay && !event.extra && <Time>{startDate.format('HH:mm')}</Time>}
      {event.extra && <Time>(ST)</Time>}
    </EventBox>
  );
}
