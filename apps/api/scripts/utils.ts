import areaCodes from '../data/area-codes';
import type { PhoneNumber } from '../src/declarations';
import lookup, { type Country } from 'country-code-lookup';

export const getCountry = (str: string): Country['iso2'] | null => {
  let country: Country | null = null;
  const keys = Object.keys(lookup);

  for (let key = 0; key < keys.length; key++) {
    const method = (lookup as any)[keys[key]];

    if (typeof method === 'function') {
      try {
        country = method(str);
      } catch (e: any) { } // eslint-disable-line
    }

    if (country) {
      break;
    }
  }

  return country?.iso2 || null;
};

export const provinceToISO = (province?: string): string | null => {
  const provinces: { [key: string]: string[] } = {
    'AR-A': ['salta'],
    'AR-B': ['buenos aires', 'ba'],
    'AR-C': ['ciudad autonoma de buenos aires', 'capital federal', 'caba', 'ciudad de buenos aires'],
    'AR-D': ['san luis'],
    'AR-E': ['entre rios', 'entre ríos'],
    'AR-F': ['la rioja'],
    'AR-G': ['santiago del estero'],
    'AR-H': ['chaco'],
    'AR-J': ['san juan'],
    'AR-K': ['catamarca'],
    'AR-L': ['la pampa'],
    'AR-M': ['mendoza'],
    'AR-N': ['misiones'],
    'AR-P': ['formosa'],
    'AR-Q': ['neuquen', 'neuquén'],
    'AR-R': ['rio negro', 'río negro'],
    'AR-S': ['santa fe'],
    'AR-T': ['tucuman', 'tucumán'],
    'AR-U': ['chubut', 'ch', 'cc', 'chu'],
    'AR-V': ['tierra del fuego'],
    'AR-W': ['corrientes', 'crr'],
    'AR-X': ['cordoba', 'córdoba'],
    'AR-Y': ['jujuy'],
    'AR-Z': ['santa cruz', 'sc'],
  };

  const normalizeString = (str?: string): string => {
    if (!str) return '';

    return str
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, ''); // Remove diacritics
  };

  const normalizedInput = normalizeString(province);

  // Find the first matching province
  for (const [isoCode, variants] of Object.entries(provinces)) {
    if (variants.some(variant => normalizeString(variant) === normalizedInput)) {
      return isoCode;
    }
  }

  // If no exact match found, try to find closest match
  for (const [isoCode, variants] of Object.entries(provinces)) {
    if (variants.some(variant =>
      normalizeString(variant).includes(normalizedInput) ||
      normalizedInput.includes(normalizeString(variant))
    )) {
      return isoCode;
    }
  }

  return null;
};

export const normalizeCity = (city?: string): string | null => {
  if (!city) return null;

  if (['paulasa mendieta', '', null, 'osde', 'elaa', 'ch', 'los duraznos 853'].includes(city)) return null;

  const cities: { [key: string]: string[] } = {
    'alto río senguer': ['rios senguer', 'rio senguer'],
    'aysen': ['AYSEN'],
    'caleta olivia': ['c olivia', 'calata olivia', 'c. olivia'],
    'cañadón seco': ['cañadón seco', 'CAÑADON SECO'],
    'ciudad autonoma de buenos aires': ['caba', 'capital federal', 'ciudad de buenos aires'],
    'comandante luis piedrabuena': ['cl piedrabuena'],
    'comodoro rivadavia': ['cr', 'crd', 'cr4', 'com', 'com.riv', 'com riv', 'c rivadavia', 'comodoro', 'comod', 'rivadav', 'omodoro', 'cod. 2816 casa 949', 'isidro quiroga', 'ch', 'los duraznos 853', 'paulasa mendieta'],
    'cushamen': ['cushamen'],
    'el bolsón': ['el bolsón', 'el bolson', 'bolson'],
    'gobernador gregores': ['g. gregores', 'G. GREGORES'],
    'la plata': ['l. plata', 'la plata', 'lp', 'l p'],
    'las heras': ['heras', 'herras', 'lasheras'],
    'perito moreno': ['p. moreno', 'p moreno', 'perito'],
    'pico truncado': ['truncado', 'Pico >Truncado', 'p truncado', 'p. truncado', 'PIDO TUNCADO', 'p. tuncado'],
    'puerto deseado': ['p. deseado', 'pto deseado', 'p deseado', 'p. desrado', 'deseado', 'Puertro Deseado'],
    'puerto madryn': ['madryn'],
    'puerto san julián': ['san julian', 'p. san julian', 'p san julian', 'P. San Juliáqn'],
    'rada tilly': ['rt', 'rada tlly', 'rada btilly', 'radatilly', 'corada tilly', 'rda tilly', 'rda tily', 'r tilly', 'r. tilly', 'r. rilly', 'tada tilly', 'rtada tilly', 'rasa tilly', 'R. RILLY'],
    'río mayo': ['rio maryo', 'r. mayo'],
    'sarmiento': ['sarrmiento', 'srmiento', 'sarmienbto', 'sarnmiento'],
    'san julián': ['san jualian'],
    'villa elisa': ['villa elisa', 'villa elis'],
    'epuyén': ['epuyen', 'epu'],
    'marcos ju��rez': ['marcos juarez - cordoba-', 'marcos juarez'],
  };

  const normalizeString = (str?: string): string => {
    if (!str) return '';

    return str
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
      .replace(/[.,º°\-_|>]/g, ' ') // Remove punctuation
      .replace(/\s+/g, ' ') // Normalize spaces
      .replace(/\d+/g, '') // Remove numbers
      .trim();
  };

  const normalizedInput = normalizeString(city);

  // Find exact match first
  for (const [cityName, variants] of Object.entries(cities)) {
    if (variants.some(variant => variant === normalizedInput) || normalizedInput === cityName) {
      return cityName;
    }
  }

  // Try partial matches
  for (const [cityName, variants] of Object.entries(cities)) {
    if (variants.some(variant => variant.includes(normalizedInput) || normalizedInput.includes(normalizeString(variant)))) {
      return cityName;
    }
  }

  // Handle special cases that include location context
  if (normalizedInput.includes('chacras') || normalizedInput.includes('deseado')) {
    if (normalizedInput.includes('olivia')) return 'caleta olivia';
    if (normalizedInput.includes('heras')) return 'las heras';
  }

  // Return original if no matches found
  return city.toLowerCase().trim();
};

export const normalizePhoneType = (phoneType?: string): string | null => {
  if (!phoneType) return null;
  return phoneType.toLowerCase().trim().slice(0, 3);
};

export const normalizePhoneNumber = (input?: string): PhoneNumber[] | null => {
  if (!input) return null; // Return null if input is undefined or null

  // Clean unwanted text in parentheses and extra whitespace
  input = input.replace(/\s*\(.*?\)\s*/g, '').trim();

  // Remove country code '54' and optional '9' prefix if present
  input = input.replace(/^54?9?/, '');

  const results: PhoneNumber[] = [];
  let areaCode = '';

  // Check if the number starts with a known area code prefixed by 0
  const matchedAreaCode = areaCodes.find(code => input && input.startsWith(code));
  if (matchedAreaCode) {
    areaCode = matchedAreaCode.replace(/^0/, ''); // Remove leading 0 from area code
    input = input.slice(matchedAreaCode.length); // Remove area code from the input
  }

  // Split by common delimiters (-, /, space)
  const parts = input.split(/[-/\s]+/).map(part => part.trim());

  parts.forEach((part, index) => {
    // Handle numbers that start with an area code in the areaCodes list
    const matchedCode = areaCodes.find(code => part.startsWith(code));
    if (matchedCode) {
      // Normalize numbers like `297154048768` to `2974048768`
      part = part.replace(new RegExp(`^${matchedCode}15?`), matchedCode);
      results.push(`cel:${part}`);
    } else if (/^15\d{6,}$/.test(part)) {
      // Detect cell numbers starting with '15' without area code
      results.push(`cel:${part}`);
    } else if (index === 0 && /^\d{6,7}$/.test(part) && areaCode) {
      // Combine with the identified area code only if part has 6+ digits
      results.push(`tel:${areaCode}${part}`);
      areaCode = ''; // Reset area code after use
    } else if (index === 1 && part.length === 2 && /^\d{2}$/.test(part)) {
      // Handle cases like '4486030/44' by replacing last 2 digits
      const previousEntry = results[results.length - 1];
      if (previousEntry && previousEntry.startsWith('tel:')) {
        const mergedTel = previousEntry.slice(4, -2) + part;
        results[results.length - 1] = `tel:${mergedTel}`;
      }
    } else if (index === 1 && part.length === 4 && /^\d{4}$/.test(part)) {
      // Handle cases like '4486030/6131' by merging last 4 digits
      const previousEntry = results[results.length - 1];
      if (previousEntry && previousEntry.startsWith('tel:')) {
        const mergedTel = previousEntry.slice(4, -4) + part;
        results[results.length - 1] = `tel:${mergedTel}`;
      }
    } else if (index === 0 && areaCode && /^\d{6,}$/.test(part)) {
      // Use area code only if followed by a sufficiently long number
      results.push(`tel:${areaCode}${part}`);
      areaCode = ''; // Clear area code once used
    } else if (/^\d{6,}$/.test(part)) {
      // Default case for standalone numbers with sufficient length
      results.push(`tel:${part}`);
    }
  });

  // Filter out null values and empty area codes
  return results.filter(result => result !== null && !result.endsWith(':'));
};

export const normalizeMaritalStatus = (maritalStatus?: string | null): string | null => {
  if (!maritalStatus) return null;
  switch (maritalStatus.toLowerCase().trim()) {
  case 'soltero': return 'single';
  case 'casado': return 'married';
  case 'divorciado': return 'divorced';
  case 'viudo': return 'widowed';
  case 'soltera': return 'single';
  case 'casada': return 'married';
  case 'divorciada': return 'divorced';
  case 'viuda': return 'widowed';
  default: return null;
  }
};

interface OldData {
  schedule_all_shifts?: Record<number, { start: string; end: string }>;
  schedule_all_week_custom_time?: boolean;
  schedule_all_week_start_time?: string;
  schedule_all_week_end_time?: string;
  schedule_all_week_shift_duration?: number;
}

interface NewSchedule {
  mondayStart: string | null;
  mondayEnd: string | null;
  tuesdayStart: string | null;
  tuesdayEnd: string | null;
  wednesdayStart: string | null;
  wednesdayEnd: string | null;
  thursdayStart: string | null;
  thursdayEnd: string | null;
  fridayStart: string | null;
  fridayEnd: string | null;
  saturdayStart: string | null;
  saturdayEnd: string | null;
  sundayStart: string | null;
  sundayEnd: string | null;
  encounterDuration: number;
}

export const transformSchedule = (oldData: OldData): NewSchedule => {
  const schedule = oldData.schedule_all_shifts || {};
  const useCustomTime = oldData.schedule_all_week_custom_time;
  const defaultStartTime = oldData.schedule_all_week_start_time || '';
  const defaultEndTime = oldData.schedule_all_week_end_time || '';

  // Convert schedule_all_week_shift_duration to a number if it's a string
  let encounterDuration = 15; // Default to 15
  if (typeof oldData.schedule_all_week_shift_duration === 'number') {
    encounterDuration = oldData.schedule_all_week_shift_duration;
  } else if (typeof oldData.schedule_all_week_shift_duration === 'string') {
    const parsedDuration = parseInt(oldData.schedule_all_week_shift_duration, 10);
    if (!isNaN(parsedDuration)) {
      encounterDuration = parsedDuration;
    }
  }

  // Map days of the week to the new format
  const newSchedule: NewSchedule = {
    mondayStart: null,
    mondayEnd: null,
    tuesdayStart: null,
    tuesdayEnd: null,
    wednesdayStart: null,
    wednesdayEnd: null,
    thursdayStart: null,
    thursdayEnd: null,
    fridayStart: null,
    fridayEnd: null,
    saturdayStart: null,
    saturdayEnd: null,
    sundayStart: null,
    sundayEnd: null,
    encounterDuration,
  };

  // Helper to map day index to keys
  const dayMap: Record<number, [keyof NewSchedule, keyof NewSchedule]> = {
    0: ['sundayStart', 'sundayEnd'],
    1: ['mondayStart', 'mondayEnd'],
    2: ['tuesdayStart', 'tuesdayEnd'],
    3: ['wednesdayStart', 'wednesdayEnd'],
    4: ['thursdayStart', 'thursdayEnd'],
    5: ['fridayStart', 'fridayEnd'],
    6: ['saturdayStart', 'saturdayEnd'],
  };

  for (let day = 0; day <= 6; day++) {
    const [startKey, endKey] = dayMap[day];
    if (useCustomTime && schedule[day]) {
      // @ts-expect-error whatever
      newSchedule[startKey] = schedule[day].start || null;
      // @ts-expect-error whatever
      newSchedule[endKey] = schedule[day].end || null;
    } else {
      // @ts-expect-error whatever
      newSchedule[startKey] = defaultStartTime || null;
      // @ts-expect-error whatever
      newSchedule[endKey] = defaultEndTime || null;
    }
  }

  return newSchedule;
};
