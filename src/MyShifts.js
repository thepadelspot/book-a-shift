import React, { useEffect, useState } from 'react';
import { fetchUserShifts, cancelShift } from './api';
import ConfirmModal from './ConfirmModal';

export default function MyShifts({ user }) {
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState({ open: false, bookingId: null, label: '' });

  const loadShifts = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchUserShifts(user.id);
      setShifts(data);
    } catch (e) {
      setError('Failed to load shifts');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadShifts();
    // eslint-disable-next-line
  }, [user.id]);

  const handleCancel = (bookingId, label) => {
    setModal({ open: true, bookingId, label });
  };

  const confirmCancel = async () => {
    setError('');
    setModal({ open: false, bookingId: null, label: '' });
    try {
      await cancelShift(modal.bookingId);
      await loadShifts();
    } catch (e) {
      setError('Cancel failed');
    }
  };

  if (loading) return <div>Loading your shifts...</div>;
  if (error) return <div style={{ color: 'red' }}>{error}</div>;
  if (!shifts.length) return <div>You have no upcoming shifts.</div>;

  return (
    <div>
      <h3>My Shifts</h3>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {shifts.map(shift => (
          <li key={shift.id} style={{ marginBottom: 12, border: '1px solid #ccc', borderRadius: 4, padding: 8 }}>
            <strong>{shift.date}</strong> &nbsp;
            {shift.start_time} - {shift.end_time}
            <button style={{ marginLeft: 16 }} onClick={() => handleCancel(shift.id, `${shift.date} ${shift.start_time}-${shift.end_time}`)}>
              Cancel
            </button>
          </li>
        ))}
      </ul>
      <ConfirmModal
        open={modal.open}
        onClose={() => setModal({ open: false, bookingId: null, label: '' })}
        onConfirm={confirmCancel}
        message={`Cancel shift: ${modal.label}?`}
        darkMode={window.document.body.classList.contains('dark-mode')}
      />
    </div>
  );
}
