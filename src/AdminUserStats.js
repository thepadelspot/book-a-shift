import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];


function getMonthRange(year, month) {
  const from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const to = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { from, to };
}

export default function AdminUserStats({ year, month, darkMode }) {
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const today = new Date();
  const [monthOffset, setMonthOffset] = useState(0);
  const baseYear = today.getFullYear();
  const baseMonth = today.getMonth();
  const showDate = new Date(baseYear, baseMonth + monthOffset, 1);
  const viewYear = showDate.getFullYear();
  const viewMonth = showDate.getMonth();

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError('');
    async function fetchAll() {
      // Get all users from public users table
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, email');
      if (usersError) {
        setError('Failed to fetch users');
        setLoading(false);
        return;
      }
      // Get all bookings for the selected month
      const { from, to } = getMonthRange(viewYear, viewMonth);
      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('user_id, status, start_time, end_time, date')
        .gte('date', from)
        .lte('date', to);
      if (bookingsError) {
        setError('Failed to fetch bookings');
        setLoading(false);
        return;
      }
      // Calculate stats per user
      const statsMap = {};
      usersData.forEach(u => {
        statsMap[u.id] = { email: u.email, hoursWorked: 0, hoursBooked: 0, booked: 0, cancellations: 0 };
      });
      const today = new Date();
      bookings.forEach(b => {
        if (!statsMap[b.user_id]) return;
        const start = parseInt(b.start_time.split(':')[0], 10);
        const end = parseInt(b.end_time.split(':')[0], 10);
        const shiftHours = end - start;
        // Parse booking date
        const bookingDate = new Date(b.date);
        if (b.status === 'booked') {
          statsMap[b.user_id].booked++;
          if (bookingDate < today) {
            statsMap[b.user_id].hoursWorked += shiftHours;
          } else {
            statsMap[b.user_id].hoursBooked += shiftHours;
          }
        } else if (b.status === 'canceled') {
          statsMap[b.user_id].cancellations++;
        }
      });
      if (isMounted) {
        setUsers(usersData);
        setStats(statsMap);
        setLoading(false);
      }
    }
    fetchAll();
    return () => { isMounted = false; };
  }, [viewYear, viewMonth]);

  if (loading) return <div>Loading user stats...</div>;
  if (error) return <div style={{ color: '#a00' }}>{error}</div>;

  return (
    <div className={`admin-user-stats${darkMode ? ' dark-mode' : ''}`} style={{ margin: '2rem 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <button
          className={`calendar-nav-btn${darkMode ? ' dark-mode' : ''}`}
          onClick={() => setMonthOffset(m => m - 1)}
          disabled={monthOffset === -24}
        >
          &lt; Prev
        </button>
        <h3>{MONTHS[viewMonth]} {viewYear}</h3>
        <button
          className={`calendar-nav-btn${darkMode ? ' dark-mode' : ''}`}
          onClick={() => setMonthOffset(m => m + 1)}
          disabled={monthOffset === 24}
        >
          Next &gt;
        </button>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th>Email</th>
            <th>Hours Worked</th>
            <th>Hours Booked</th>
            <th>Shifts Booked</th>
            <th>Cancellations</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id}>
              <td>{u.email}</td>
              <td>{stats[u.id]?.hoursWorked || 0}</td>
              <td>{stats[u.id]?.hoursBooked || 0}</td>
              <td>{stats[u.id]?.booked || 0}</td>
              <td>{stats[u.id]?.cancellations || 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
