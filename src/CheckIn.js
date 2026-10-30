import React, { useState, useEffect } from 'react';
import { handleCheckIn as apiHandleCheckIn } from './api';

function CheckIn({ shift, user, onCheckInComplete, darkMode }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // Check if already checked in
    if (shift?.checked_in_at) {
      setChecked(true);
    }
  }, [shift]);

  const handleCheckIn = async () => {
    setLoading(true);
    setError('');
    try {
      if (!navigator.geolocation) {
        throw new Error('Geolocation not supported on this device');
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude } = position.coords;

            // Get current time in HH:MM format
            const now = new Date();
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const checkInTime = `${hours}:${minutes}`;

            // Call API to handle check-in with intelligent time adjustments
            await apiHandleCheckIn(shift.id, checkInTime, latitude, longitude);

            setChecked(true);
            if (onCheckInComplete) onCheckInComplete();
          } catch (err) {
            setError(err.message || 'Check-in failed');
            setLoading(false);
          }
        },
        (error) => {
          setError(`Location error: ${error.message}`);
          setLoading(false);
        }
      );
    } catch (err) {
      setError(err.message || 'Check-in failed');
      setLoading(false);
    }
  };

  if (checked) {
    return (
      <div style={{
        padding: '1rem',
        marginBottom: '1rem',
        background: darkMode ? '#1a4d2e' : '#d4edda',
        border: `2px solid ${darkMode ? '#2ecc40' : '#28a745'}`,
        borderRadius: '8px',
        color: darkMode ? '#86efac' : '#155724',
      }}>
        ✓ Checked in {shift?.checked_in_at ? new Date(shift.checked_in_at).toLocaleTimeString() : 'now'}
      </div>
    );
  }

  return (
    <div style={{
      padding: '1rem',
      marginBottom: '1rem',
      background: darkMode ? '#1a2f4d' : '#cfe2ff',
      border: `2px solid ${darkMode ? '#0056b3' : '#084298'}`,
      borderRadius: '8px',
      color: darkMode ? '#93d5ff' : '#084298',
    }}>
      <div style={{ marginBottom: '0.75rem', fontWeight: 600 }}>
        Time to check in!
      </div>
      <p style={{ margin: '0.5rem 0', fontSize: '0.9rem' }}>
        Please check in by tapping the button below. Your location will be recorded. If you arrive late, your start time and the previous person's end time will be automatically adjusted.
      </p>
      {error && (
        <div style={{
          color: '#ff6b6b',
          marginBottom: '0.75rem',
          fontSize: '0.9rem',
          background: darkMode ? 'rgba(255, 68, 68, 0.1)' : 'rgba(255, 107, 107, 0.1)',
          padding: '0.5rem',
          borderRadius: '4px'
        }}>
          {error}
        </div>
      )}
      <button
        onClick={handleCheckIn}
        disabled={loading}
        style={{
          background: loading ? '#6c757d' : '#28a745',
          color: '#fff',
          border: 'none',
          padding: '0.6rem 1.2rem',
          borderRadius: '8px',
          cursor: loading ? 'not-allowed' : 'pointer',
          fontSize: '1rem',
          fontWeight: 600,
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? 'Getting location...' : 'Check In Now'}
      </button>
    </div>
  );
}

export default CheckIn;
