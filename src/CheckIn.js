import React, { useState, useEffect } from 'react';
import { handleCheckIn as apiHandleCheckIn } from './api';

// Premises coordinates - stored in codebase
const PREMISES = {
  latitude: 53.627147,
  longitude: -2.1836641,
  radius: 50, // meters
  name: 'The Padel Spot'
};

// Calculate distance between two coordinates (in meters) using Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

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

  // Check if check-in is available (5 minutes before shift starts)
  const now = new Date();
  const currentHours = now.getHours();
  const currentMinutes = now.getMinutes();
  const currentTimeInMinutes = currentHours * 60 + currentMinutes;

  const [shiftStartH, shiftStartM] = (shift?.start_time || '00:00').split(':').map(Number);
  const shiftStartInMinutes = shiftStartH * 60 + shiftStartM;

  const checkInAvailableAt = shiftStartInMinutes - 5;
  const checkInAvailable = currentTimeInMinutes >= checkInAvailableAt;

  const handleCheckIn = async () => {
    setLoading(true);
    setError('');
    try {
      // Check if current time is within check-in window (5 min before to end of shift)
      const now = new Date();
      const currentHours = now.getHours();
      const currentMinutes = now.getMinutes();
      const currentTimeInMinutes = currentHours * 60 + currentMinutes;

      const [shiftStartH, shiftStartM] = (shift.start_time || '00:00').split(':').map(Number);
      const shiftStartInMinutes = shiftStartH * 60 + shiftStartM;

      const [shiftEndH, shiftEndM] = (shift.end_time || '00:00').split(':').map(Number);
      const shiftEndInMinutes = shiftEndH * 60 + shiftEndM;

      const checkInWindow = shiftStartInMinutes - 5;

      // Handle overnight shifts
      let isWithinCheckInWindow = false;
      if (shiftEndInMinutes < shiftStartInMinutes) {
        // Overnight shift - check in 5 min before start until end
        isWithinCheckInWindow = (currentTimeInMinutes >= checkInWindow && currentTimeInMinutes < 1440) ||
                                (currentTimeInMinutes >= 0 && currentTimeInMinutes < shiftEndInMinutes);
      } else {
        // Regular shift - check in 5 min before start until end
        isWithinCheckInWindow = currentTimeInMinutes >= checkInWindow && currentTimeInMinutes < shiftEndInMinutes;
      }

      if (!isWithinCheckInWindow) {
        const shiftStartStr = shift.start_time || '00:00';
        const shiftEndStr = shift.end_time || '00:00';
        setError(
          `Check-in available 5 min before your shift starts. ` +
          `Shift: ${shiftStartStr} – ${shiftEndStr}`
        );
        setLoading(false);
        return;
      }

      if (!navigator.geolocation) {
        throw new Error('Geolocation not supported on this device');
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude } = position.coords;

            // Calculate distance from premises
            const distanceToVenue = calculateDistance(
              latitude,
              longitude,
              PREMISES.latitude,
              PREMISES.longitude
            );

            // Check if within acceptable radius
            if (distanceToVenue > PREMISES.radius) {
              setError(
                `You are ${Math.round(distanceToVenue)}m away from ${PREMISES.name}. ` +
                `You must be within ${PREMISES.radius}m to check in.`
              );
              setLoading(false);
              return;
            }

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
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
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

  // Hide check-in if not yet in check-in window
  if (!checkInAvailable) {
    return (
      <div style={{
        padding: '1rem',
        marginBottom: '1rem',
        background: darkMode ? '#1a2a3d' : '#f0f4f8',
        border: `1px solid ${darkMode ? '#334455' : '#d1d5db'}`,
        borderRadius: '8px',
        color: darkMode ? '#8899bb' : '#6b7280',
        fontSize: '0.9rem',
      }}>
        ⏰ Check-in available at {shift?.start_time ? (
          (() => {
            const [h, m] = (shift.start_time).split(':').map(Number);
            const checkInH = h + Math.floor((m - 5) / 60);
            const checkInM = (m - 5 + 60) % 60;
            return `${String(checkInH).padStart(2, '0')}:${String(checkInM).padStart(2, '0')}`;
          })()
        ) : '00:00'}
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
        🔍 Check in to start your shift
      </div>
      <p style={{ margin: '0.5rem 0', fontSize: '0.9rem' }}>
        Must be within {PREMISES.radius}m of {PREMISES.name} to check in.
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
          ⚠️ {error}
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
          transition: 'all 0.2s ease',
        }}
      >
        {loading ? 'Getting location...' : 'Check In Now'}
      </button>
    </div>
  );
}

export default CheckIn;
