// Calendar-only arithmetic for a product's stated period after opening.
// A period anniversary is not the printed expiration date of a specific lot.
const pad2 = value => String(value).padStart(2, '0');

function daysInMonth(year, month) {
  if (month === 2) return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function parseCalendarDate(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

function isoDate({ year, month, day }) {
  return `${String(year).padStart(4, '0')}-${pad2(month)}-${pad2(day)}`;
}

/** Add whole calendar months, clamping the day when the target month is shorter. */
export function addCalendarMonths(openedDate, months) {
  const parts = parseCalendarDate(openedDate);
  if (!parts || !Number.isSafeInteger(months) || months <= 0) return null;
  const absoluteMonth = (parts.year - 1) * 12 + parts.month - 1 + months;
  if (!Number.isSafeInteger(absoluteMonth) || absoluteMonth >= 9999 * 12) return null;
  const year = Math.floor(absoluteMonth / 12) + 1;
  const month = absoluteMonth % 12 + 1;
  return isoDate({ year, month, day: Math.min(parts.day, daysInMonth(year, month)) });
}

/** Render an ISO calendar date without time-zone conversion. */
export function formatCalendarDate(value) {
  const parts = parseCalendarDate(value);
  return parts ? `${String(parts.year).padStart(4, '0')}.${pad2(parts.month)}.${pad2(parts.day)}` : null;
}

/** Return an informational opening-period anniversary, or null for bad input. */
export function getOpeningPeriod(openedDate, months) {
  const date = addCalendarMonths(openedDate, months);
  if (!date) return null;
  const formattedDate = formatCalendarDate(date);
  return { date, formattedDate, label: `개봉 후 ${months}개월 도달일 ${formattedDate}` };
}
