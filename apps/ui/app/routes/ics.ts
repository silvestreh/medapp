/**
 * This route is used to fetch the holidays from the Google Calendar API and return them in a JSON format.
 * Hitting /ics will return the holidays for the current year.
 */

import { fetchHolidays } from '~/utils/holidays.server';

export const loader = async () => {
  const holidays = await fetchHolidays();

  return new Response(JSON.stringify(holidays), {
    headers: {
      'Cache-Control': 'public, max-age=86400',
    },
  });
};
