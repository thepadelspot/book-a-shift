import React, { useState, useEffect, useCallback } from 'react';
import {
  fetchShiftTemplates,
  fetchShiftOverrides,
  addShiftTemplate,
  deleteShiftTemplate,
  addShiftOverride,
  deleteShiftOverride,
  deleteShiftOverridesForDate,
} from './api';
import { formatShiftTime } from './utils/shiftConfig';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function timeStrToDecimal(t) {
  const [h, m] = (t || '00:00').split(':').map(Number);
  return h + (m || 0) / 60;
}


function formatDateHuman(dateStr) {
  if (!dateStr) return '';
  const date = new Date(`${dateStr}T12:00:00`);
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const n = date.getDate();
  const suffix = n > 3 && n < 21 ? 'th' : ['th','st','nd','rd','th','th','th','th','th','th'][n % 10];
  return `${days[date.getDay()]} ${n}${suffix} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

function groupByDate(overrides) {
  const map = {};
  overrides.forEach(o => {
    if (!map[o.date]) map[o.date] = [];
    map[o.date].push(o);
  });
  Object.values(map).forEach(slots => slots.sort((a, b) => a.start_hour - b.start_hour));
  return map;
}

export default function AdminShiftConfig({ darkMode }) {
  const [templates, setTemplates] = useState([]);
  const [overrides, setOverrides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Month navigation for overrides
  const today = new Date();
  const [monthOffset, setMonthOffset] = useState(0);
  const viewDate = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const viewYear = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth();
  const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  // Template add-slot form (per day of week)
  const [addingToDow, setAddingToDow] = useState(null);
  const [newStartHour, setNewStartHour] = useState('');
  const [newDuration, setNewDuration] = useState('4');

  // "Customize a date" form
  const [customizeDate, setCustomizeDate] = useState('');
  const [customizeError, setCustomizeError] = useState('');

  // Per-date inline add-slot form
  const [addingSlotToDate, setAddingSlotToDate] = useState(null);
  const [dateSlotStartHour, setDateSlotStartHour] = useState('');
  const [dateSlotDuration, setDateSlotDuration] = useState('4');
  const [dateSlotError, setDateSlotError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [t, o] = await Promise.all([fetchShiftTemplates(), fetchShiftOverrides(viewYear, viewMonth)]);
      setTemplates(t);
      setOverrides(o);
    } catch {
      setError('Failed to load shift configuration');
    }
    setLoading(false);
  }, [viewYear, viewMonth]);

  useEffect(() => { load(); }, [load]);

  // Derived: group templates by day_of_week
  const templatesByDow = {};
  DAY_NAMES.forEach((_, i) => { templatesByDow[i] = []; });
  templates.forEach(t => { templatesByDow[t.day_of_week]?.push(t); });
  Object.values(templatesByDow).forEach(slots => slots.sort((a, b) => a.start_hour - b.start_hour));

  const overridesByDate = groupByDate(overrides);
  const overrideDates = Object.keys(overridesByDate).sort();

  // ── Template handlers ──

  const handleAddTemplate = async (dow) => {
    const h = timeStrToDecimal(newStartHour);
    const d = parseFloat(newDuration);
    if (!newStartHour || isNaN(h) || isNaN(d) || d < 0.25 || d > 12) {
      setError('Invalid start time or duration (0.25–12)');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await addShiftTemplate(dow, h, d);
      setNewStartHour('');
      setNewDuration('4');
      setAddingToDow(null);
      await load();
    } catch {
      setError('Failed to save template slot');
    }
    setSaving(false);
  };

  const handleDeleteTemplate = async (id) => {
    setSaving(true);
    setError('');
    try {
      await deleteShiftTemplate(id);
      await load();
    } catch {
      setError('Failed to delete template slot');
    }
    setSaving(false);
  };

  // ── Override handlers ──

  // Seed a date from the template (copies the day-of-week template into overrides for that date)
  const handleCustomizeDate = async () => {
    setCustomizeError('');
    if (!customizeDate) { setCustomizeError('Select a date'); return; }
    if (overridesByDate[customizeDate]) {
      // Already customized — just open the inline add-slot form for it
      setAddingSlotToDate(customizeDate);
      setCustomizeDate('');
      return;
    }
    const dow = new Date(`${customizeDate}T12:00:00`).getDay();
    const slotsToSeed = templatesByDow[dow] || [];
    setSaving(true);
    try {
      for (const slot of slotsToSeed) {
        await addShiftOverride(customizeDate, slot.start_hour, slot.duration_hours);
      }
      setCustomizeDate('');
      await load();
    } catch {
      setCustomizeError('Failed to customise date');
    }
    setSaving(false);
  };

  const handleAddSlotToDate = async (date) => {
    setDateSlotError('');
    const h = timeStrToDecimal(dateSlotStartHour);
    const d = parseFloat(dateSlotDuration);
    if (!dateSlotStartHour || isNaN(h) || isNaN(d) || d < 0.25 || d > 12) {
      setDateSlotError('Invalid start time or duration (0.25–12)');
      return;
    }
    setSaving(true);
    try {
      await addShiftOverride(date, h, d);
      setDateSlotStartHour('');
      setDateSlotDuration('4');
      setAddingSlotToDate(null);
      await load();
    } catch {
      setDateSlotError('Failed to add slot');
    }
    setSaving(false);
  };

  const handleDeleteOverride = async (id) => {
    setSaving(true);
    setError('');
    try {
      await deleteShiftOverride(id);
      await load();
    } catch {
      setError('Failed to delete slot');
    }
    setSaving(false);
  };

  const handleResetDate = async (date) => {
    if (!window.confirm(`Reset ${formatDateHuman(date)} back to the weekly template?`)) return;
    setSaving(true);
    setError('');
    try {
      await deleteShiftOverridesForDate(date);
      if (addingSlotToDate === date) setAddingSlotToDate(null);
      await load();
    } catch {
      setError('Failed to reset date');
    }
    setSaving(false);
  };

  if (loading) return <div>Loading shift configuration...</div>;

  const inputStyle = { padding: '4px 8px', borderRadius: 4, border: '1px solid #ccc', width: 64, textAlign: 'center' };
  const btnStyle = (color) => ({
    padding: '4px 10px', borderRadius: 4, border: 'none', background: color,
    color: '#fff', cursor: 'pointer', fontSize: '0.85em', fontWeight: 600,
  });

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '0 1rem' }}>
      {error && <div style={{ color: '#a00', marginBottom: 8 }}>{error}</div>}

      {/* ── Weekly template ── */}
      <h3 style={{ marginBottom: 12 }}>Weekly Template</h3>
      <p style={{ color: '#666', fontSize: '0.9em', marginBottom: 16 }}>
        These shifts apply to every week unless a specific date is customised below.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {DAY_NAMES.map((dayName, dow) => (
          <div key={dow} style={{
            border: '1px solid #ddd', borderRadius: 8, padding: '10px 14px',
            background: darkMode ? '#1e1e1e' : '#fafafa',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <strong>{dayName}</strong>
              <button
                style={{ ...btnStyle('#2980b9'), padding: '3px 10px' }}
                onClick={() => { setAddingToDow(addingToDow === dow ? null : dow); setNewStartHour(''); setNewDuration('4'); setError(''); }}
                disabled={saving}
              >
                + Add slot
              </button>
            </div>

            {templatesByDow[dow].length === 0 && addingToDow !== dow && (
              <div style={{ color: '#999', fontSize: '0.85em' }}>No shifts configured</div>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {templatesByDow[dow].map(slot => (
                <div key={slot.id} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: darkMode ? '#2a2a2a' : '#eef4ff',
                  border: '1px solid #b0c8f0', borderRadius: 6, padding: '3px 8px',
                }}>
                  <span style={{ fontSize: '0.9em' }}>{formatShiftTime(slot.start_hour, slot.duration_hours)}</span>
                  <button
                    onClick={() => handleDeleteTemplate(slot.id)}
                    disabled={saving}
                    style={{ background: 'none', border: 'none', color: '#c00', cursor: 'pointer', fontSize: '1em', lineHeight: 1, padding: 0 }}
                    title="Remove slot"
                  >×</button>
                </div>
              ))}
            </div>

            {addingToDow === dow && (
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                <label style={{ fontSize: '0.85em' }}>Start:</label>
                <input type="time" step="900"
                  value={newStartHour} onChange={e => setNewStartHour(e.target.value)} style={inputStyle} />
                <label style={{ fontSize: '0.85em' }}>Duration (h):</label>
                <input type="number" min="0.25" max="12" step="0.25" placeholder="e.g. 4"
                  value={newDuration} onChange={e => setNewDuration(e.target.value)} style={inputStyle} />
                {newStartHour !== '' && !isNaN(parseFloat(newDuration)) && (
                  <span style={{ fontSize: '0.8em', color: '#555' }}>
                    → {formatShiftTime(timeStrToDecimal(newStartHour), parseFloat(newDuration))}
                  </span>
                )}
                <button style={btnStyle('#27ae60')} onClick={() => handleAddTemplate(dow)} disabled={saving}>Save</button>
                <button style={btnStyle('#888')} onClick={() => setAddingToDow(null)} disabled={saving}>Cancel</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Date overrides ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 32, marginBottom: 8 }}>
        <h3 style={{ margin: 0 }}>Date Overrides</h3>
        <button className={`calendar-nav-btn${darkMode ? ' dark-mode' : ''}`} onClick={() => setMonthOffset(o => o - 1)}>&lt; Prev</button>
        <strong>{MONTH_NAMES[viewMonth]} {viewYear}</strong>
        <button className={`calendar-nav-btn${darkMode ? ' dark-mode' : ''}`} onClick={() => setMonthOffset(o => o + 1)}>Next &gt;</button>
      </div>
      <p style={{ color: '#666', fontSize: '0.9em', marginBottom: 16 }}>
        Customise shifts for a specific date. Start by copying the weekly template for that day, then add or remove individual slots.
      </p>

      {/* "Customize a date" form */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10,
        padding: '10px 14px', border: '1px solid #ddd', borderRadius: 8,
        background: darkMode ? '#1e1e1e' : '#fafafa', marginBottom: 20,
      }}>
        <input
          type="date"
          value={customizeDate}
          onChange={e => { setCustomizeDate(e.target.value); setCustomizeError(''); }}
          style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #ccc' }}
        />
        <button style={btnStyle('#2980b9')} onClick={handleCustomizeDate} disabled={saving || !customizeDate}>
          Customise date
        </button>
        {customizeDate && templatesByDow[new Date(`${customizeDate}T12:00:00`).getDay()]?.length > 0 && !overridesByDate[customizeDate] && (
          <span style={{ fontSize: '0.8em', color: '#555' }}>
            Copies {templatesByDow[new Date(`${customizeDate}T12:00:00`).getDay()].length} template slot(s) for {DAY_NAMES[new Date(`${customizeDate}T12:00:00`).getDay()]}
          </span>
        )}
        {customizeDate && overridesByDate[customizeDate] && (
          <span style={{ fontSize: '0.8em', color: '#888' }}>Already customised — will open for editing</span>
        )}
        {customizeError && <span style={{ color: '#a00', fontSize: '0.85em' }}>{customizeError}</span>}
      </div>

      {/* List upcoming customised dates */}
      {overrideDates.length === 0 ? (
        <div style={{ color: '#999', fontSize: '0.9em' }}>No upcoming date overrides.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {overrideDates.map(date => (
            <div key={date} style={{
              border: '1px solid #f0c060', borderRadius: 8, padding: '10px 14px',
              background: darkMode ? '#1e1e1e' : '#fffbf0',
            }}>
              {/* Date header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <strong>{formatDateHuman(date)}</strong>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    style={{ ...btnStyle('#2980b9'), padding: '3px 10px', fontSize: '0.8em' }}
                    onClick={() => {
                      setAddingSlotToDate(addingSlotToDate === date ? null : date);
                      setDateSlotStartHour('');
                      setDateSlotDuration('4');
                      setDateSlotError('');
                    }}
                    disabled={saving}
                  >
                    + Add slot
                  </button>
                  <button
                    style={{ ...btnStyle('#c0392b'), padding: '3px 10px', fontSize: '0.8em' }}
                    onClick={() => handleResetDate(date)}
                    disabled={saving}
                    title="Remove all overrides — reverts to weekly template"
                  >
                    Reset to template
                  </button>
                </div>
              </div>

              {/* Existing slots */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: addingSlotToDate === date ? 10 : 0 }}>
                {overridesByDate[date].length === 0 ? (
                  <span style={{ color: '#999', fontSize: '0.85em' }}>No shifts (day will show as empty)</span>
                ) : overridesByDate[date].map(slot => (
                  <div key={slot.id} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: darkMode ? '#2a2a2a' : '#fff4d0',
                    border: '1px solid #e0b040', borderRadius: 6, padding: '3px 8px',
                  }}>
                    <span style={{ fontSize: '0.9em' }}>{formatShiftTime(slot.start_hour, slot.duration_hours)}</span>
                    <button
                      onClick={() => handleDeleteOverride(slot.id)}
                      disabled={saving}
                      style={{ background: 'none', border: 'none', color: '#c00', cursor: 'pointer', fontSize: '1em', lineHeight: 1, padding: 0 }}
                      title="Remove this slot"
                    >×</button>
                  </div>
                ))}
              </div>

              {/* Inline add-slot form */}
              {addingSlotToDate === date && (
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, paddingTop: 8, borderTop: '1px solid #e0c060' }}>
                  <label style={{ fontSize: '0.85em' }}>Start:</label>
                  <input type="time" step="900"
                    value={dateSlotStartHour} onChange={e => setDateSlotStartHour(e.target.value)} style={inputStyle} />
                  <label style={{ fontSize: '0.85em' }}>Duration (h):</label>
                  <input type="number" min="0.25" max="12" step="0.25" placeholder="e.g. 1"
                    value={dateSlotDuration} onChange={e => setDateSlotDuration(e.target.value)} style={inputStyle} />
                  {dateSlotStartHour !== '' && !isNaN(parseFloat(dateSlotDuration)) && (
                    <span style={{ fontSize: '0.8em', color: '#555' }}>
                      → {formatShiftTime(timeStrToDecimal(dateSlotStartHour), parseFloat(dateSlotDuration))}
                    </span>
                  )}
                  <button style={btnStyle('#27ae60')} onClick={() => handleAddSlotToDate(date)} disabled={saving}>Save</button>
                  <button style={btnStyle('#888')} onClick={() => setAddingSlotToDate(null)} disabled={saving}>Cancel</button>
                  {dateSlotError && <span style={{ color: '#a00', fontSize: '0.85em' }}>{dateSlotError}</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
