// Shared date and time formatting utilities

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Format date as "Wednesday 1st January 2026"
export function formatDateHuman(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const dayName = DAYS[date.getDay()];
  const dayNum = date.getDate();
  const monthName = MONTHS[date.getMonth()];
  const year = date.getFullYear();

  function ordinal(n) {
    if (n > 3 && n < 21) return 'th';
    switch (n % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  }

  return `${dayName} ${dayNum}${ordinal(dayNum)} ${monthName} ${year}`;
}

// Format date as "1 Jan" (short format for PDF)
export function formatDateShort(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const dayNum = date.getDate();
  const monthName = MONTHS[date.getMonth()].slice(0, 3); // First 3 letters
  return `${dayNum} ${monthName}`;
}

// Get day of week as short name (Mon, Tue, etc.)
export function getDayOfWeek(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return SHORT_DAYS[date.getDay()];
}

// Format time as "8am" or "4pm"
export function formatTimeHuman(timeStr) {
  if (!timeStr) return '';
  const [h] = timeStr.split(':');
  let hour = parseInt(h, 10);
  let suffix = hour < 12 ? 'am' : 'pm';
  if (hour === 0) hour = 12;
  if (hour > 12) hour -= 12;
  return `${hour}${suffix}`;
}

// Format time range as "08:00-12:00"
export function formatTimeRange(startTime, endTime) {
  if (!startTime || !endTime) return '';
  const [startH] = startTime.split(':');
  const [endH] = endTime.split(':');
  return `${startH.padStart(2, '0')}:00-${endH.padStart(2, '0')}:00`;
}

// Get current date formatted as "3rd March 2026"
export function getCurrentDateFormatted() {
  const today = new Date();
  const dayNum = today.getDate();
  const monthName = MONTHS[today.getMonth()];
  const year = today.getFullYear();

  function ordinal(n) {
    if (n > 3 && n < 21) return 'th';
    switch (n % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  }

  return `${dayNum}${ordinal(dayNum)} ${monthName} ${year}`;
}
