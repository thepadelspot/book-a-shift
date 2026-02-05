import React, { useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { supabase } from './supabaseClient';

const UserStats = forwardRef(({ userId }, ref) => {
  const [stats, setStats] = useState({ hours: 0, cancellations: 0 });
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(null);
  const [month, setMonth] = useState(null);

  const fetchStats = async () => {
    setLoading(true);
    let from, to;
    if (year !== null && month !== null) {
      from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month + 1, 0).getDate();
      to = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    }
    let query = supabase
      .from('bookings')
      .select('status, start_time, end_time, date')
      .eq('user_id', userId);
    if (from && to) {
      query = query.gte('date', from).lte('date', to);
    }
    const { data, error } = await query;
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
    setStats({ hours, cancellations });
    setLoading(false);
  };

  useImperativeHandle(ref, () => ({
    refresh: fetchStats,
    setMonthYear: (y, m) => {
      setYear(y);
      setMonth(m);
    }
  }));

  useEffect(() => {
    fetchStats();
    // eslint-disable-next-line
  }, [userId, year, month]);

  if (loading) return <div>Loading stats...</div>;
  return (
    <div style={{ margin: '1rem 0' }}>
      <strong>Hours booked:</strong> {stats.hours} <br />
      <strong>Cancellations:</strong> {stats.cancellations}
    </div>
  );
});

UserStats.displayName = 'UserStats';

export default UserStats;
