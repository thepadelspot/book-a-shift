import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

export default function UserStats({ userId }) {
  const [stats, setStats] = useState({ hours: 0, cancellations: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function fetchStats() {
      setLoading(true);
      // Get all bookings for this user
      const { data, error } = await supabase
        .from('bookings')
        .select('status, start_time, end_time')
        .eq('user_id', userId);
      if (error || !data) {
        setStats({ hours: 0, cancellations: 0 });
        setLoading(false);
        return;
      }
      let hours = 0;
      let cancellations = 0;
      data.forEach(b => {
        if (b.status === 'booked') {
          const start = parseInt(b.start_time.split(':')[0], 10);
          const end = parseInt(b.end_time.split(':')[0], 10);
          hours += end - start;
        } else if (b.status === 'canceled') {
          cancellations++;
        }
      });
      if (isMounted) setStats({ hours, cancellations });
      setLoading(false);
    }
    fetchStats();
    return () => { isMounted = false; };
  }, [userId]);

  if (loading) return <div>Loading stats...</div>;
  return (
    <div style={{ margin: '1rem 0' }}>
      <strong>Hours booked:</strong> {stats.hours} <br />
      <strong>Cancellations:</strong> {stats.cancellations}
    </div>
  );
}
