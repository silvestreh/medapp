import ICAL from 'ical.js';
import dayjs from 'dayjs';

export const loader = async () => {
  const icsUrl =
    'https://calendar.google.com/calendar/ical/es-419.ar%23holiday%40group.v.calendar.google.com/public/basic.ics';

  try {
    const response = await fetch(icsUrl);
    const icsData = await response.text();
    const jcalData = ICAL.parse(icsData);
    const comp = new ICAL.Component(jcalData);
    const vevents = comp.getAllSubcomponents('vevent');

    const parsedEvents = vevents.map(vevent => {
      const event = new ICAL.Event(vevent);
      return {
        id: event.uid,
        title: event.summary,
        startDate: dayjs(event.startDate.toString()).startOf('day').add(1, 'hour').toISOString(),
        endDate: dayjs(event.startDate.toString()).endOf('day').subtract(1, 'hour').toISOString(),
        allDay: true,
        variant: 'green',
      };
    });

    return new Response(JSON.stringify(parsedEvents), {
      headers: {
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error) {
    console.error('Error fetching or parsing ICS:', error);
    return new Response(JSON.stringify([]), { status: 500 });
  }
};
