import { useEffect, useState, useCallback } from 'react';
import { supabase } from './supabaseClient';
import { approveBooking, denyBooking } from './api';

function shiftHours(start_time, end_time) {
  const [sh, sm] = start_time.split(':').map(Number);
  const [eh, em] = end_time.split(':').map(Number);
  const s = sh + sm / 60;
  const e = eh + em / 60;
  return e > s ? e - s : 24 - s + e;
}

function formatDateHuman(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const n = d.getDate();
  const ord = (n) => { if (n > 3 && n < 21) return 'th'; switch (n % 10) { case 1: return 'st'; case 2: return 'nd'; case 3: return 'rd'; default: return 'th'; } };
  return `${days[d.getDay()]} ${n}${ord(n)} ${months[d.getMonth()]}`;
}

function formatTime(t) {
  if (!t) return '';
  const [h] = t.split(':');
  let hour = parseInt(h, 10);
  const suf = hour < 12 ? 'am' : 'pm';
  if (hour === 0) hour = 12;
  if (hour > 12) hour -= 12;
  return `${hour}${suf}`;
}

// Auto-allocate algorithm (pure — no side effects, used for both preview and execution)
function computeAllocation(requests, weights) {
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0) || 1;
  const targetShare = {};
  Object.entries(weights).forEach(([uid, w]) => { targetShare[uid] = w / totalWeight; });

  // Group by slot key (date|start_time) — each slot can hold one person
  const slotMap = {};
  requests.forEach(r => {
    const key = `${r.date}|${r.start_time}`;
    if (!slotMap[key]) slotMap[key] = [];
    slotMap[key].push(r);
  });

  const sortedSlots = Object.entries(slotMap).sort(([a], [b]) => a.localeCompare(b));
  const approvedHours = {};
  let totalApproved = 0;
  const decisions = {}; // bookingId → 'approve' | 'deny'

  sortedSlots.forEach(([, requesters]) => {
    if (requesters.length === 1) {
      const r = requesters[0];
      decisions[r.id] = 'approve';
      const h = shiftHours(r.start_time, r.end_time);
      approvedHours[r.user_id] = (approvedHours[r.user_id] || 0) + h;
      totalApproved += h;
    } else {
      // Pick user with greatest deficit (target share − current share)
      let winner = null;
      let bestScore = -Infinity;
      requesters.forEach(r => {
        const myApproved = approvedHours[r.user_id] || 0;
        const myShare = totalApproved > 0 ? myApproved / totalApproved : 0;
        const score = (targetShare[r.user_id] || 0) - myShare;
        if (score > bestScore || (score === bestScore && (weights[r.user_id] || 5) > (weights[winner?.user_id] || 5))) {
          bestScore = score;
          winner = r;
        }
      });
      requesters.forEach(r => {
        decisions[r.id] = r.id === winner.id ? 'approve' : 'deny';
      });
      if (winner) {
        const h = shiftHours(winner.start_time, winner.end_time);
        approvedHours[winner.user_id] = (approvedHours[winner.user_id] || 0) + h;
        totalApproved += h;
      }
    }
  });

  return { decisions, approvedHours };
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function AdminBookingRequests({ darkMode }) {
  const today = new Date();
  const [monthOffset, setMonthOffset] = useState(0);
  const viewDate = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const viewYear = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth();

  const [users, setUsers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [weights, setWeights] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [acting, setActing] = useState(null);
  const [autoAllocating, setAutoAllocating] = useState(false);
  const [hideAdmins, setHideAdmins] = useState(true);
  const ADMIN_FIRST_NAMES = ['adnan', 'haroon', 'emadul', 'taha', 'azeem'];

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    const fromDate = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(viewYear, viewMonth + 1, 0).getDate();
    const toDate = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    try {
      const [{ data: usersData, error: ue }, { data: reqData, error: re }] = await Promise.all([
        supabase.from('users').select('id, email, firstName, lastName'),
        supabase.from('bookings').select('*')
          .eq('status', 'pending')
          .gte('date', fromDate).lte('date', toDate)
          .order('date').order('start_time'),
      ]);
      if (ue) throw ue;
      if (re) throw re;
      setUsers(usersData || []);
      setRequests(reqData || []);
      // Weights are session-only — reset to 5 for each new month load
      const wMap = {};
      (usersData || []).forEach(u => { wMap[u.id] = 5; });
      setWeights(wMap);
    } catch (e) {
      setError('Failed to load data');
    }
    setLoading(false);
  }, [viewYear, viewMonth]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleWeightChange = (userId, value) => {
    setWeights(prev => ({ ...prev, [userId]: Number(value) }));
  };

  const handleApprove = async (bookingId) => {
    setActing(bookingId);
    try {
      await approveBooking(bookingId);
      setRequests(prev => prev.filter(r => r.id !== bookingId));
    } catch {
      setError('Failed to approve');
    }
    setActing(null);
  };

  const handleDeny = async (bookingId) => {
    setActing(bookingId);
    try {
      await denyBooking(bookingId);
      setRequests(prev => prev.filter(r => r.id !== bookingId));
    } catch {
      setError('Failed to deny');
    }
    setActing(null);
  };

  const handleAutoAllocate = async () => {
    setAutoAllocating(true);
    setError('');
    try {
      const { decisions } = computeAllocation(requests, weights);
      await Promise.all(
        Object.entries(decisions).map(([id, action]) =>
          action === 'approve' ? approveBooking(id) : denyBooking(id)
        )
      );
      setRequests([]);
    } catch {
      setError('Auto-allocate failed');
    }
    setAutoAllocating(false);
  };

  if (loading) return <div style={{ textAlign: 'center', marginTop: '2rem' }}>Loading requests...</div>;

  // Preview: run algorithm with current weights (no DB writes)
  const { approvedHours: previewHours } = computeAllocation(requests, weights);

  // Group requests by slot key so we can flag contested slots
  const slotMap = {};
  requests.forEach(r => {
    const key = `${r.date}|${r.start_time}`;
    if (!slotMap[key]) slotMap[key] = [];
    slotMap[key].push(r.id);
  });
  const isContested = (r) => (slotMap[`${r.date}|${r.start_time}`]?.length ?? 0) > 1;

  // Group requests by date for the list
  const byDate = {};
  requests.forEach(r => {
    if (!byDate[r.date]) byDate[r.date] = [];
    byDate[r.date].push(r);
  });
  const sortedDates = Object.keys(byDate).sort();

  // User lookup
  const userMap = {};
  users.forEach(u => { userMap[u.id] = u; });

  const visibleUsers = users.filter(u =>
    !hideAdmins || !ADMIN_FIRST_NAMES.includes((u.firstName || '').toLowerCase())
  );

  const border = darkMode ? '#333' : '#dde';
  const cardBg = darkMode ? '#1e2128' : '#fff';
  const headerBg = darkMode ? '#2a2e38' : '#f0f4ff';
  const subText = darkMode ? '#888' : '#aaa';
  const text = darkMode ? '#e0e0e0' : '#181818';

  return (
    <div style={{ padding: '0 1rem 3rem', maxWidth: 700, margin: '0 auto', color: text }}>
      <h3 style={{ textAlign: 'center', marginBottom: '1rem', fontSize: '1.5rem', fontWeight: 600 }}>Booking Requests</h3>

      {/* Month navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <button
          className={`calendar-nav-btn${darkMode ? ' dark-mode' : ''}`}
          onClick={() => setMonthOffset(m => m - 1)}
          disabled={monthOffset === -24}
        >
          &lt; Prev
        </button>
        <span style={{ fontWeight: 600, fontSize: '1.1rem', minWidth: 160, textAlign: 'center' }}>
          {MONTHS[viewMonth]} {viewYear}
        </span>
        <button
          className={`calendar-nav-btn${darkMode ? ' dark-mode' : ''}`}
          onClick={() => setMonthOffset(m => m + 1)}
          disabled={monthOffset === 24}
        >
          Next &gt;
        </button>
      </div>

      {error && <div style={{ color: '#c0392b', marginBottom: 12 }}>{error}</div>}

      {/* ── User Weights & Allocation Preview ── */}
      <div style={{ border: `1px solid ${border}`, borderRadius: 10, marginBottom: 24, overflow: 'hidden' }}>
        <div style={{ background: headerBg, padding: '0.65rem 1rem', fontWeight: 600, fontSize: '0.95rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>User Weights &amp; Allocation Preview</span>
          <label style={{ fontWeight: 400, fontSize: '0.85rem', cursor: 'pointer', userSelect: 'none', color: subText }}>
            <input type="checkbox" checked={hideAdmins} onChange={e => setHideAdmins(e.target.checked)} style={{ marginRight: 5 }} />
            Hide admins
          </label>
        </div>

        {/* Table header */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px 80px 100px', gap: 0, background: darkMode ? '#252930' : '#fafbff', padding: '0.4rem 1rem', fontSize: '0.8rem', color: subText, fontWeight: 600, borderBottom: `1px solid ${border}` }}>
          <span>User</span>
          <span>Weight</span>
          <span style={{ textAlign: 'center' }}>Pending</span>
          <span style={{ textAlign: 'right' }}>If Auto-Alloc</span>
        </div>

        {visibleUsers.map(u => {
          const userRequests = requests.filter(r => r.user_id === u.id);
          const wouldGetHours = previewHours[u.id] || 0;
          const wouldGetShifts = Object.entries(
            computeAllocation(requests, weights).decisions
          ).filter(([id, action]) => action === 'approve' && requests.find(r => r.id === id && r.user_id === u.id)).length;

          return (
            <div key={u.id} style={{ display: 'grid', gridTemplateColumns: '1fr 180px 80px 100px', gap: 0, padding: '0.55rem 1rem', borderBottom: `1px solid ${border}`, background: cardBg, alignItems: 'center' }}>
              <span style={{ fontWeight: 500, fontSize: '0.92rem' }}>
                {`${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={weights[u.id] ?? 5}
                  onChange={e => handleWeightChange(u.id, e.target.value)}
                  style={{ width: 110, accentColor: '#4499ee' }}
                />
                <span style={{ minWidth: 18, fontWeight: 600, color: '#4499ee', fontSize: '0.9rem' }}>{weights[u.id] ?? 5}</span>
              </span>
              <span style={{ textAlign: 'center', fontSize: '0.9rem', color: userRequests.length > 0 ? '#0055aa' : subText }}>
                {userRequests.length}
              </span>
              <span style={{ textAlign: 'right', fontSize: '0.85rem' }}>
                {userRequests.length > 0 ? (
                  <span style={{ color: darkMode ? '#5cb85c' : '#1a7f1a', fontWeight: 500 }}>
                    {wouldGetShifts} shift{wouldGetShifts !== 1 ? 's' : ''} ({+wouldGetHours.toFixed(1)}h)
                  </span>
                ) : (
                  <span style={{ color: subText }}>—</span>
                )}
              </span>
            </div>
          );
        })}

        {/* Auto Allocate button */}
        <div style={{ padding: '0.75rem 1rem', background: headerBg, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12 }}>
          {requests.length === 0 && (
            <span style={{ fontSize: '0.88rem', color: subText }}>No pending requests</span>
          )}
          <button
            onClick={handleAutoAllocate}
            disabled={autoAllocating || requests.length === 0}
            style={{
              padding: '0.45rem 1.2rem',
              borderRadius: 6,
              border: 'none',
              background: requests.length === 0 ? '#aaa' : '#2ecc71',
              color: '#fff',
              fontWeight: 600,
              fontSize: '0.95rem',
              cursor: requests.length === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            {autoAllocating ? 'Allocating…' : 'Auto Allocate'}
          </button>
        </div>
      </div>

      {/* ── Pending Requests List ── */}
      {requests.length === 0 ? (
        <div style={{ textAlign: 'center', color: subText, marginTop: '2rem' }}>No pending requests</div>
      ) : (
        <>
          <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: 10, color: subText }}>
            {requests.length} pending request{requests.length !== 1 ? 's' : ''}
          </div>
          {sortedDates.map(date => (
            <div key={date} style={{ marginBottom: 12 }}>
              {/* Date header */}
              <div style={{ background: headerBg, border: `1px solid ${border}`, borderRadius: '8px 8px 0 0', padding: '0.5rem 0.8rem', fontWeight: 600, fontSize: '0.9rem', color: darkMode ? '#a0b0ff' : '#3355cc' }}>
                {formatDateHuman(date)}
              </div>
              {/* Request rows */}
              <div style={{ border: `1px solid ${border}`, borderTop: 'none', borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
                {byDate[date].map((req, i) => {
                  const u = userMap[req.user_id];
                  const name = u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email : req.user_id;
                  const contested = isContested(req);
                  const isLast = i === byDate[date].length - 1;
                  const busy = acting === req.id;
                  return (
                    <div
                      key={req.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '0.55rem 0.8rem',
                        background: cardBg,
                        borderBottom: isLast ? 'none' : `1px solid ${darkMode ? '#2c2c2c' : '#eee'}`,
                        gap: '0.5rem',
                      }}
                    >
                      <span style={{ fontWeight: 500, fontSize: '0.92rem', flex: 1 }}>{name}</span>
                      <span style={{ color: '#888', fontSize: '0.88rem', minWidth: 80 }}>
                        {formatTime(req.start_time)} – {formatTime(req.end_time)}
                      </span>
                      {contested && (
                        <span style={{ fontSize: '0.75rem', background: '#fff3cd', color: '#856404', borderRadius: 4, padding: '2px 6px', fontWeight: 600 }}>
                          Contested
                        </span>
                      )}
                      <button
                        onClick={() => handleApprove(req.id)}
                        disabled={busy}
                        style={{ padding: '0.28rem 0.7rem', borderRadius: 5, border: 'none', background: '#27ae60', color: '#fff', fontWeight: 500, fontSize: '0.82rem', cursor: busy ? 'not-allowed' : 'pointer' }}
                      >
                        {busy ? '…' : 'Approve'}
                      </button>
                      <button
                        onClick={() => handleDeny(req.id)}
                        disabled={busy}
                        style={{ padding: '0.28rem 0.7rem', borderRadius: 5, border: 'none', background: '#c0392b', color: '#fff', fontWeight: 500, fontSize: '0.82rem', cursor: busy ? 'not-allowed' : 'pointer' }}
                      >
                        {busy ? '…' : 'Deny'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
