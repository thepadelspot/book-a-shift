import React, { useState, useEffect } from 'react';
import { fetchClosedDays, supabase } from './api';

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
    <div className={`admin-closed-days${darkMode ? ' dark-mode' : ''}`} style={{ margin: '2rem 0' }}>
      <h3>Closed Days (Admin)</h3>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} />
        <input type="text" value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason (optional)" />
        <button onClick={handleAdd} disabled={loading || !newDate}>Add</button>
      </div>
      {error && <div style={{ color: '#a00' }}>{error}</div>}
      <ul>
        {closedDays.map(day => (
          <li key={day.id} style={{ marginBottom: 4 }}>
            {day.date} {day.reason && `- ${day.reason}`}
            <button style={{ marginLeft: 8 }} onClick={() => handleDelete(day.id)} disabled={loading}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
