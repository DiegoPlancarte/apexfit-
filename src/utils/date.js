/**
 * Centralized Local Timezone Date & Timestamp Utilities
 *
 * Ensures all session timestamps, log dates, and UI displays strictly
 * respect the user's local timezone (e.g. Pacific Time / browser local time)
 * rather than defaulting to UTC, preventing late-evening date roll-overs.
 */

/**
 * Returns a 'YYYY-MM-DD' calendar date string strictly in local timezone.
 *
 * @param {Date|number|string} [input=new Date()]
 * @returns {string} Formatted local date string 'YYYY-MM-DD'
 */
export const getLocalDateString = (input = new Date()) => {
  if (!input) return '';
  if (typeof input === 'string') {
    // If input already has a YYYY-MM-DD prefix without time or with time,
    // preserve the intended calendar date if it's a simple date string
    const match = input.match(/^(\d{4}-\d{2}-\d{2})$/);
    if (match) return match[1];
  }

  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Returns an ISO-8601 string representing local date/time with the local timezone offset.
 * Example in Pacific Time (UTC-8): '2026-11-05T19:24:37.000-08:00'
 *
 * @param {Date|number|string} [input=new Date()]
 * @returns {string} Full ISO-8601 string with local timezone offset
 */
export const getLocalIsoString = (input = new Date()) => {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const ms = String(date.getMilliseconds()).padStart(3, '0');

  const offsetMinutes = -date.getTimezoneOffset();
  let offsetStr = 'Z';
  if (offsetMinutes !== 0) {
    const sign = offsetMinutes >= 0 ? '+' : '-';
    const absMinutes = Math.abs(offsetMinutes);
    const offHours = String(Math.floor(absMinutes / 60)).padStart(2, '0');
    const offMins = String(absMinutes % 60).padStart(2, '0');
    offsetStr = `${sign}${offHours}:${offMins}`;
  }

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${ms}${offsetStr}`;
};

/**
 * Parses a 'YYYY-MM-DD' or ISO string to a Date object set at local midnight.
 * Prevents JavaScript's default UTC midnight parsing of 'YYYY-MM-DD' which rolls back one day in US timezones.
 *
 * @param {string|Date} dateStr
 * @returns {Date} Date instance at local midnight
 */
export const parseLocalDate = (dateStr) => {
  if (!dateStr) return new Date();
  if (dateStr instanceof Date) return dateStr;

  if (typeof dateStr === 'string') {
    const datePart = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    const parts = datePart.split('-');
    if (parts.length === 3) {
      const [y, m, d] = parts.map(Number);
      if (!Number.isNaN(y) && !Number.isNaN(m) && !Number.isNaN(d)) {
        return new Date(y, m - 1, d);
      }
    }
  }

  return new Date(dateStr);
};

/**
 * Formats a date into a human-friendly string in the user's local timezone.
 *
 * @param {string|Date} input
 * @param {Intl.DateTimeFormatOptions} [options]
 * @returns {string} e.g., 'Wed, Nov 5, 2026'
 */
export const formatFriendlyLocalDate = (input, options = {}) => {
  if (!input) return '';
  const date = parseLocalDate(input);
  if (Number.isNaN(date.getTime())) return String(input);

  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...options,
  });
};

/**
 * Checks whether two dates or date strings fall on the exact same local calendar day.
 *
 * @param {Date|string} a
 * @param {Date|string} b
 * @returns {boolean}
 */
export const isSameLocalDate = (a, b) => {
  return getLocalDateString(a) === getLocalDateString(b);
};
