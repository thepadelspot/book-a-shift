/**
 * Build a per-date map of shift slots for a given month.
 *
 * For each date:
 *  - If any shift_overrides exist for that date, use those (override replaces template entirely)
 *  - Otherwise use the shift_templates for that day of week
 *
 * Returns: { 'YYYY-MM-DD': [{id, start_hour, duration_hours}, ...] }
 */
export function buildShiftConfigMap(year, month, templates, overrides) {
  // Group overrides by date string
  const overridesByDate = {};
  overrides.forEach(o => {
    if (!overridesByDate[o.date]) overridesByDate[o.date] = [];
    overridesByDate[o.date].push(o);
  });

  // Group templates by day_of_week
  const templatesByDow = {};
  templates.forEach(t => {
    if (!templatesByDow[t.day_of_week]) templatesByDow[t.day_of_week] = [];
    templatesByDow[t.day_of_week].push(t);
  });

  const result = {};
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let d = 1; d <= daysInMonth; d++) {
    const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dow = new Date(`${dateKey}T12:00:00`).getDay(); // noon avoids DST edge cases

    const slots = overridesByDate[dateKey] ?? templatesByDow[dow] ?? [];
    result[dateKey] = [...slots].sort((a, b) => a.start_hour - b.start_hour);
  }

  return result;
}

/**
 * Format a shift time range for display.
 * e.g. start_hour=23, duration_hours=4 → "23:00 – 03:00 (next day)"
 *      start_hour=7,  duration_hours=4 → "07:00 – 11:00"
 */
export function formatShiftTime(start_hour, duration_hours) {
  const endTotal = parseFloat(start_hour) + parseFloat(duration_hours);
  const crossesMidnight = endTotal >= 24;
  const endNorm = endTotal % 24;
  const fmtTime = (h) => {
    const hh = Math.floor(h);
    const mm = Math.round((h - hh) * 60);
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  };
  return crossesMidnight
    ? `${fmtTime(start_hour)} – ${fmtTime(endNorm)} (next day)`
    : `${fmtTime(start_hour)} – ${fmtTime(endNorm)}`;
}

/** Convert a decimal hour (e.g. 7.25) to an HH:MM:00 time string. */
export function decimalHourToTimeStr(h) {
  const hh = Math.floor(parseFloat(h));
  const mm = Math.round((parseFloat(h) - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`;
}

/** Convert an HH:MM[:SS] time string to a decimal hour (e.g. "07:15:00" → 7.25). */
export function startTimeToDecimal(t) {
  const [h, m] = (t || '00:00').split(':').map(Number);
  return h + (m || 0) / 60;
}

/**
 * Compute end_time string for DB insertion.
 * Supports fractional hours (e.g. 0.5 = 30 minutes).
 * For a 23:00 + 4h shift, end_time stored as "03:00:00".
 */
export function computeEndTime(start_hour, duration_hours) {
  const endTotal = (parseFloat(start_hour) + parseFloat(duration_hours)) % 24;
  const hh = Math.floor(endTotal);
  const mm = Math.round((endTotal - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`;
}
