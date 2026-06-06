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

// Auto-allocate algorithm (pure — no side effects).
//
// Only users who have at least one pending request in this batch contribute to
// the weight pool. Users with zero requests are excluded so their weights don't
// dilute other people's target shares.
//
// Contested slots use greedy deficit scoring with two additions:
//
// 1. Adjacency bonus (+0.1): a user who already has an approved adjacent slot on
//    the same day gets a small boost so consecutive shifts cluster together.
//
// 2. Compensation credit: if a user loses a contested slot solely because of
//    someone else's adjacency bonus (their base score was higher but the bonus
//    flipped the result), they accumulate a credit equal to that bonus. The credit
//    is carried forward and added to their score in future contested slots,
//    ensuring they are prioritised elsewhere to offset the disadvantage. The
//    credit is cleared when they next win a contested slot.
function computeAllocation(requests, weights) {
  const requestingUserIds = new Set(requests.map(r => r.user_id));
  const activeWeights = {};
  Object.entries(weights).forEach(([uid, w]) => {
    if (requestingUserIds.has(uid)) activeWeights[uid] = w;
  });
  const totalWeight = Object.values(activeWeights).reduce((a, b) => a + b, 0) || 1;
  const targetShare = {};
  Object.entries(activeWeights).forEach(([uid, w]) => { targetShare[uid] = w / totalWeight; });

  const slotMap = {};
  requests.forEach(r => {
    const key = `${r.date}|${r.start_time}`;
    if (!slotMap[key]) slotMap[key] = [];
    slotMap[key].push(r);
  });

  const sortedSlots = Object.entries(slotMap).sort(([a], [b]) => a.localeCompare(b));
  const approvedHours = {};
  let totalApproved = 0;
  const decisions = {};
  const compensation = {}; // uid → credit accumulated from being displaced by adjacency bonus

  sortedSlots.forEach(([, requesters]) => {
    if (requesters.length === 1) {
      const r = requesters[0];
      decisions[r.id] = 'approve';
      const h = shiftHours(r.start_time, r.end_time);
      approvedHours[r.user_id] = (approvedHours[r.user_id] || 0) + h;
      totalApproved += h;
    } else {
      // Score each requester, tracking base score and adjacency bonus separately
      const scored = requesters.map(r => {
        const myApproved = approvedHours[r.user_id] || 0;
        const myShare = totalApproved > 0 ? myApproved / totalApproved : 0;
        const deficit = (targetShare[r.user_id] || 0) - myShare;
        const credit = compensation[r.user_id] || 0;
        const hasAdjacentApproved = requests.some(req =>
          req.user_id === r.user_id &&
          req.date === r.date &&
          decisions[req.id] === 'approve' &&
          (req.end_time === r.start_time || req.start_time === r.end_time)
        );
        const adjacencyBonus = hasAdjacentApproved ? 0.1 : 0;
        const baseScore = deficit + credit;
        return { r, baseScore, adjacencyBonus, totalScore: baseScore + adjacencyBonus };
      });

      const winner = scored.reduce((best, cur) =>
        cur.totalScore > best.totalScore ||
        (cur.totalScore === best.totalScore && (activeWeights[cur.r.user_id] || 5) > (activeWeights[best.r.user_id] || 5))
          ? cur : best
      );

      scored.forEach(({ r, baseScore }) => {
        if (r.id === winner.r.id) return;
        decisions[r.id] = 'deny';
        // If this user's base score exceeded the winner's base score, the adjacency
        // bonus was the sole reason they lost — give them a compensation credit.
        if (baseScore > winner.baseScore) {
          compensation[r.user_id] = (compensation[r.user_id] || 0) + winner.adjacencyBonus;
        }
      });

      decisions[winner.r.id] = 'approve';
      compensation[winner.r.user_id] = 0; // winning a contested slot clears the credit
      const h = shiftHours(winner.r.start_time, winner.r.end_time);
      approvedHours[winner.r.user_id] = (approvedHours[winner.r.user_id] || 0) + h;
      totalApproved += h;
    }
  });

  return { decisions, approvedHours };
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function AllocationConfirmModal({ preview, userMap, darkMode, onConfirm, onCancel, confirming }) {
  const { decisions, breakdown, approvedHours } = preview;

  const totalApproved = Object.values(decisions).filter(d => d === 'approve').length;
  const totalDenied = Object.values(decisions).filter(d => d === 'deny').length;

  const usersWithBreakdown = Object.entries(breakdown)
    .map(([uid, { approved, denied }]) => ({ uid, approved, denied, user: userMap[uid] }))
    .sort((a, b) => b.approved.length - a.approved.length);

  const bg = darkMode ? '#1a1d24' : '#fff';
  const border = darkMode ? '#333' : '#dde';
  const text = darkMode ? '#e0e0e0' : '#181818';
  const subText = darkMode ? '#888' : '#aaa';
  const headerBg = darkMode ? '#2a2e38' : '#f0f4ff';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem',
    }}>
      <div style={{
        background: bg, borderRadius: 12, width: '100%', maxWidth: 560,
        maxHeight: '85vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 8px 40px rgba(0,0,0,0.35)',
        border: `1px solid ${border}`,
      }}>
        {/* Header */}
        <div style={{ padding: '1rem 1.2rem 0.75rem', borderBottom: `1px solid ${border}` }}>
          <div style={{ fontWeight: 700, fontSize: '1.1rem', color: text, marginBottom: 2 }}>
            Confirm Auto Allocation
          </div>
          <div style={{ fontSize: '0.85rem', color: subText }}>
            {totalApproved} shift{totalApproved !== 1 ? 's' : ''} approved &nbsp;·&nbsp;
            {totalDenied} request{totalDenied !== 1 ? 's' : ''} denied
          </div>
        </div>

        {/* Scrollable breakdown */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '0.75rem 1.2rem' }}>
          {usersWithBreakdown.map(({ uid, approved, denied, user }) => {
            const name = user
              ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email
              : uid;
            const hours = approvedHours[uid] || 0;
            return (
              <div key={uid} style={{ marginBottom: '1rem' }}>
                <div style={{
                  fontWeight: 600, fontSize: '0.92rem', color: text,
                  marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  {name}
                  {approved.length > 0 && (
                    <span style={{ fontSize: '0.78rem', color: subText, fontWeight: 400 }}>
                      {approved.length} shift{approved.length !== 1 ? 's' : ''} · {+hours.toFixed(1)}h
                    </span>
                  )}
                </div>
                {approved.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: denied.length ? 4 : 0 }}>
                    {approved
                      .slice().sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time))
                      .map(req => (
                        <div key={req.id} style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '3px 8px', borderRadius: 5,
                          background: darkMode ? '#1a3a20' : '#eafaf1',
                          fontSize: '0.83rem',
                        }}>
                          <span style={{ color: '#27ae60', fontWeight: 600, fontSize: '0.75rem' }}>✓</span>
                          <span style={{ color: darkMode ? '#6dca8a' : '#1a7f3c', fontWeight: 500 }}>
                            {formatDateHuman(req.date)}
                          </span>
                          <span style={{ color: subText }}>
                            {formatTime(req.start_time)} – {formatTime(req.end_time)}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
                {denied.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {denied
                      .slice().sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time))
                      .map(req => (
                        <div key={req.id} style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '3px 8px', borderRadius: 5,
                          background: darkMode ? '#3a1a1a' : '#fdf0f0',
                          fontSize: '0.83rem',
                        }}>
                          <span style={{ color: '#c0392b', fontWeight: 600, fontSize: '0.75rem' }}>✗</span>
                          <span style={{ color: darkMode ? '#d47070' : '#a00', fontWeight: 500 }}>
                            {formatDateHuman(req.date)}
                          </span>
                          <span style={{ color: subText }}>
                            {formatTime(req.start_time)} – {formatTime(req.end_time)}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer buttons */}
        <div style={{
          padding: '0.75rem 1.2rem',
          borderTop: `1px solid ${border}`,
          background: headerBg,
          display: 'flex', justifyContent: 'flex-end', gap: 10,
          borderRadius: '0 0 12px 12px',
        }}>
          <button
            onClick={onCancel}
            disabled={confirming}
            style={{
              padding: '0.45rem 1.1rem', borderRadius: 6, fontWeight: 500, fontSize: '0.9rem',
              border: `1px solid ${border}`, background: 'transparent', color: text, cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={confirming}
            style={{
              padding: '0.45rem 1.2rem', borderRadius: 6, border: 'none',
              background: confirming ? '#aaa' : '#2ecc71',
              color: '#fff', fontWeight: 600, fontSize: '0.95rem',
              cursor: confirming ? 'not-allowed' : 'pointer',
            }}
          >
            {confirming ? 'Applying…' : 'Confirm & Apply'}
          </button>
        </div>
      </div>
    </div>
  );
}

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
  const [allocationPreview, setAllocationPreview] = useState(null);
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

  const handleAutoAllocatePreview = () => {
    const { decisions, approvedHours } = computeAllocation(requests, weights);
    const breakdown = {};
    Object.entries(decisions).forEach(([id, action]) => {
      const req = requests.find(r => r.id === id);
      if (!req) return;
      const uid = req.user_id;
      if (!breakdown[uid]) breakdown[uid] = { approved: [], denied: [] };
      breakdown[uid][action === 'approve' ? 'approved' : 'denied'].push(req);
    });
    setAllocationPreview({ decisions, breakdown, approvedHours });
  };

  const handleConfirmAutoAllocate = async () => {
    if (!allocationPreview) return;
    setAutoAllocating(true);
    setError('');
    try {
      await Promise.all(
        Object.entries(allocationPreview.decisions).map(([id, action]) =>
          action === 'approve' ? approveBooking(id) : denyBooking(id)
        )
      );
      setRequests([]);
      setAllocationPreview(null);
    } catch {
      setError('Auto-allocate failed');
    }
    setAutoAllocating(false);
  };

  if (loading) return <div style={{ textAlign: 'center', marginTop: '2rem' }}>Loading requests...</div>;

  const { approvedHours: previewHours, decisions: previewDecisions } = computeAllocation(requests, weights);

  // Baseline: everyone who has requests gets equal weight — used to show the delta each slider causes
  const baselineWeights = {};
  requests.forEach(r => { baselineWeights[r.user_id] = 5; });
  const { decisions: baselineDecisions } = computeAllocation(requests, baselineWeights);

  const slotMap = {};
  requests.forEach(r => {
    const key = `${r.date}|${r.start_time}`;
    if (!slotMap[key]) slotMap[key] = [];
    slotMap[key].push(r.id);
  });
  const isContested = (r) => (slotMap[`${r.date}|${r.start_time}`]?.length ?? 0) > 1;

  const byDate = {};
  requests.forEach(r => {
    if (!byDate[r.date]) byDate[r.date] = [];
    byDate[r.date].push(r);
  });
  const sortedDates = Object.keys(byDate).sort();

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
      {allocationPreview && (
        <AllocationConfirmModal
          preview={allocationPreview}
          userMap={userMap}
          darkMode={darkMode}
          onConfirm={handleConfirmAutoAllocate}
          onCancel={() => setAllocationPreview(null)}
          confirming={autoAllocating}
        />
      )}

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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px 80px 100px', gap: 0, background: darkMode ? '#252930' : '#fafbff', padding: '0.4rem 1rem', fontSize: '0.8rem', color: subText, fontWeight: 600, borderBottom: `1px solid ${border}` }}>
          <span>User</span>
          <span>Weight</span>
          <span style={{ textAlign: 'center' }}>Pending</span>
          <span style={{ textAlign: 'right' }}>If Auto-Alloc</span>
        </div>

        {visibleUsers.map(u => {
          const userRequests = requests.filter(r => r.user_id === u.id);
          const wouldGetHours = previewHours[u.id] || 0;
          const wouldGetShifts = Object.entries(previewDecisions)
            .filter(([id, action]) => action === 'approve' && requests.find(r => r.id === id && r.user_id === u.id)).length;
          const baselineShifts = Object.entries(baselineDecisions)
            .filter(([id, action]) => action === 'approve' && requests.find(r => r.id === id && r.user_id === u.id)).length;
          const delta = wouldGetShifts - baselineShifts;

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
              <span style={{ textAlign: 'right', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5 }}>
                {userRequests.length > 0 ? (
                  <>
                    <span style={{ color: darkMode ? '#5cb85c' : '#1a7f1a', fontWeight: 500 }}>
                      {wouldGetShifts} shift{wouldGetShifts !== 1 ? 's' : ''} ({+wouldGetHours.toFixed(1)}h)
                    </span>
                    {delta !== 0 && (
                      <span style={{
                        fontSize: '0.78rem', fontWeight: 700,
                        color: delta > 0 ? '#27ae60' : '#c0392b',
                      }}>
                        {delta > 0 ? `+${delta}` : delta}
                      </span>
                    )}
                  </>
                ) : (
                  <span style={{ color: subText }}>—</span>
                )}
              </span>
            </div>
          );
        })}

        <div style={{ padding: '0.75rem 1rem', background: headerBg, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12 }}>
          {requests.length === 0 && (
            <span style={{ fontSize: '0.88rem', color: subText }}>No pending requests</span>
          )}
          <button
            onClick={handleAutoAllocatePreview}
            disabled={requests.length === 0}
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
            Auto Allocate
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
              <div style={{ background: headerBg, border: `1px solid ${border}`, borderRadius: '8px 8px 0 0', padding: '0.5rem 0.8rem', fontWeight: 600, fontSize: '0.9rem', color: darkMode ? '#a0b0ff' : '#3355cc' }}>
                {formatDateHuman(date)}
              </div>
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
