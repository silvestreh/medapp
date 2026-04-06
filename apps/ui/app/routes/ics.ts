/**
 * This route is used to fetch the holidays from the Google Calendar API and return them in a JSON format.
 * Hitting /ics will return the holidays for the current year.
 */

import ICAL from 'ical.js';
import dayjs from 'dayjs';

export const loader = async () => {
  const icsUrl =
    'https://calendar.google.com/calendar/ical/es-419.ar%23holiday%40group.v.calendar.google.com/public/basic.ics';

  try {
    const response = await fetch(icsUrl);
    console.log(`[ics] Google Calendar response: status=${response.status} content-type=${response.headers.get('content-type')}`);

    const icsData = await response.text();

    if (!response.ok) {
      console.error(`[ics] Google Calendar returned non-OK status ${response.status}. Body: ${icsData.slice(0, 500)}`);
      return new Response(JSON.stringify([]), { status: 200 });
    }

    if (!icsData.startsWith('BEGIN:VCALENDAR')) {
      console.error(`[ics] Unexpected response body (first 500 chars): ${icsData.slice(0, 500)}`);
      return new Response(JSON.stringify([]), { status: 200 });
    }

    const jcalData = ICAL.parse(icsData);
    const comp = new ICAL.Component(jcalData);
    const vevents = comp.getAllSubcomponents('vevent');

    const parsedEvents = vevents.map(vevent => {
      const event = new ICAL.Event(vevent);
      return {
        id: event.uid,
        title: event.summary,
        startDate: dayjs(event.startDate.toString()).startOf('day').add(6, 'hours').toISOString(),
        endDate: dayjs(event.startDate.toString()).endOf('day').subtract(6, 'hours').toISOString(),
        allDay: true,
        variant: 'green',
      };
    });

    console.log(`[ics] Parsed ${parsedEvents.length} holiday events`);

    return new Response(JSON.stringify(parsedEvents), {
      headers: {
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error) {
    console.error('[ics] Error fetching or parsing ICS:', error);
    return new Response(JSON.stringify([]), { status: 200 });
  }
};
