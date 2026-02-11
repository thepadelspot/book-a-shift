import React, { useState, useEffect } from 'react';
import { fetchClosedDays } from './api';
import { supabase } from './supabaseClient';

function formatDateHuman(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dayName = days[date.getDay()];
  const dayNum = date.getDate();
  const monthName = months[date.getMonth()];
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

export default function AdminClosedDays({ year, month, darkMode }) {
  const [closedDays, setClosedDays] = useState([]);
  const [newDate, setNewDate] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchClosedDays(year, month).then(setClosedDays);
  }, [year, month]);

  const handleAdd = async () => {
    setError('');
    setLoading(true);
    try {
      const { error } = await supabase.from('closed_days').insert([
        { date: newDate, reason }
      ]);
      if (error) throw error;
      setNewDate('');
      setReason('');
      setClosedDays(await fetchClosedDays(year, month));
    } catch (e) {
      setError('Failed to add closed day');
    }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    setError('');
    setLoading(true);
    try {
      const { error } = await supabase.from('closed_days').delete().eq('id', id);
      if (error) throw error;
      setClosedDays(await fetchClosedDays(year, month));
    } catch (e) {
      setError('Failed to delete');
    }
    setLoading(false);
  };

  return (
    <div className={`admin-closed-days${darkMode ? ' dark-mode' : ''}`} style={{ margin: '2rem 0', padding: '0 1rem', boxSizing: 'border-box' }}>
      <div className={`closed-days-admin${darkMode ? ' dark-mode' : ''}`} style={{ boxSizing: 'border-box', width: '100%', maxWidth: 600, margin: '0 auto' }}>
        <form className={`closed-days-form${darkMode ? ' dark-mode' : ''}`} onSubmit={e => { e.preventDefault(); handleAdd(); }}>
          <input
            type="date"
            value={newDate}
            onChange={e => setNewDate(e.target.value)}
            className="closed-days-input"
          />
          <input
            type="text"
            placeholder="Reason (optional)"
            value={reason}
            onChange={e => setReason(e.target.value)}
            className="closed-days-input"
          />
          <button className="closed-days-btn" type="submit" disabled={loading || !newDate}>Add</button>
        </form>
        {error && <div className="closed-days-error">{error}</div>}
        <ul className="closed-days-list">
          {closedDays.map(day => (
            <li key={day.id} className="closed-days-item">
              <div className="closed-days-date">
                <strong>{formatDateHuman(day.date)}</strong> {day.reason && <span className="closed-days-reason">({day.reason})</span>}
              </div>
              <button className="closed-days-delete" onClick={() => handleDelete(day.id)} disabled={loading}>Delete</button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}