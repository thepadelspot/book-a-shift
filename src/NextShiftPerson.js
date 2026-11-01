import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

function NextShiftPerson({ shift, darkMode }) {
  const [nextPerson, setNextPerson] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNextPerson = async () => {
      try {
        setLoading(true);
        // Find the next shift on the same date that starts after this shift ends
        const { data: nextShifts, error } = await supabase
          .from('bookings')
          .select('id, user_id, start_time, end_time, users(firstName, lastName, email)')
          .eq('date', shift.date)
          .eq('status', 'booked')
          .gte('start_time', shift.end_time)
          .order('start_time', { ascending: true })
          .limit(1);

        if (error) {
          console.error('Error fetching next shift:', error);
          return;
        }

        if (nextShifts && nextShifts.length > 0) {
          const next = nextShifts[0];
          // Handle both 'users' and 'user' relationship names
          const userData = next.users || next.user;
          const name = userData
            ? `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || userData.email
            : 'Unknown';
          setNextPerson({
            name,
            email: userData?.email,
            startTime: next.start_time,
          });
        }
      } catch (err) {
        console.error('Error:', err);
      } finally {
        setLoading(false);
      }
    };

    if (shift?.date && shift?.end_time) {
      fetchNextPerson();
    }
  }, [shift]);

  if (loading || !nextPerson) return null;

  return (
    <div style={{
      padding: '0.75rem 0.8rem',
      background: darkMode ? '#1a3d2e' : '#e8f5e9',
      borderLeft: `4px solid ${darkMode ? '#4caf50' : '#2ecc40'}`,
      marginTop: '0.5rem',
      borderRadius: '4px',
      fontSize: '0.9rem',
      color: darkMode ? '#a8d5ba' : '#2d5a3d',
    }}>
      <strong>Next shift:</strong> {nextPerson.name} at {nextPerson.startTime}
      {nextPerson.email && (
        <div style={{ fontSize: '0.85rem', opacity: 0.8, marginTop: '0.25rem' }}>
          {nextPerson.email}
        </div>
      )}
    </div>
  );
}

export default NextShiftPerson;
