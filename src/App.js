
import './App.css';
import './admin-user-stats-center.css';
import AuthProvider from './AuthProvider';
import AuthContext from './AuthContext';
import LoginPage from './LoginPage';
import ResetPasswordPage from './ResetPasswordPage';
import React, { useContext, useState } from 'react';
import BookPage from './BookPage';
import Navbar from './Navbar';
import horizontalLogo from './assets/landscape.png';
import AdminClosedDays from './AdminClosedDays';
import AdminUserStats from './AdminUserStats';
import AdminShiftConfig from './AdminShiftConfig';
import AdminBookingRequests from './AdminBookingRequests';
import MyShifts from './MyShifts';





const AppContent = () => {
  // Hooks must be called at the top level, before any conditional logic
  const { user, loading } = useContext(AuthContext);
  const [page, setPage] = useState('book');
  const [darkMode, setDarkMode] = useState(() => {
    const stored = localStorage.getItem('darkMode');
    return stored === 'true';
  });
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [isAdminLoading, setIsAdminLoading] = React.useState(true);

  React.useEffect(() => {
    document.body.classList.toggle('dark-mode', darkMode);
    localStorage.setItem('darkMode', darkMode);
  }, [darkMode]);

  React.useEffect(() => {
    let isMounted = true;
    if (!user?.id) {
      setIsAdminLoading(false);
      return;
    }
    setIsAdminLoading(true);
    import('./supabaseClient').then(({ supabase }) => {
      supabase
        .from('roles')
        .select('role')
        .eq('user_id', user.id)
        .single()
        .then(({ data }) => {
          if (isMounted) setIsAdmin(data?.role === 'admin');
        })
        .finally(() => {
          if (isMounted) setIsAdminLoading(false);
        });
    });
    return () => { isMounted = false; };
  }, [user]);

  // Show password reset page if hash in URL
  if (window.location.hash.startsWith('#/reset')) {
    return <ResetPasswordPage />;
  }
  if (loading) return <div className="loading-container"><div className="loading-spinner"></div><div className="loading-text">Loading...</div></div>;
  if (!user) return <LoginPage darkMode={darkMode} />;
  if (isAdminLoading) return <div className="loading-container"><div className="loading-spinner"></div><div className="loading-text">Loading...</div></div>;
  return (
    <div className={`App${darkMode ? ' dark-mode' : ''}`}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: '1.5rem', borderBottom: darkMode ? '1px solid #334155' : '1px solid #e5e7eb', marginBottom: '1.5rem' }}>
        <img src={horizontalLogo} alt="Padel Spot Logo" style={{ height: '110px', marginBottom: '1rem', filter: darkMode ? 'brightness(1.1)' : 'none' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '0.5rem' }}>
          <button
            className={`dark-mode-toggle${darkMode ? '' : ' light'}`}
            onClick={() => setDarkMode(d => !d)}
            aria-label="Toggle dark mode"
          >
            {darkMode ? '🌙' : '☀️'}
          </button>
          {(user?.firstName || user?.email) && (
            <span style={{ fontSize: '1.1rem', fontWeight: 600, color: darkMode ? '#f1f5f9' : '#111827' }}>
              Hello, {user?.firstName ? user.firstName : user.email}
            </span>
          )}
        </div>
      </div>
      <Navbar onNavigate={setPage} currentPage={page} darkMode={darkMode} isAdmin={isAdmin} />
      {page === 'book' && <BookPage user={user} darkMode={darkMode} />}
      {page === 'myshifts' && <MyShifts user={user} />}
      {isAdmin && page === 'requests' && (
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          <AdminBookingRequests darkMode={darkMode} />
        </div>
      )}
      {isAdmin && page === 'closed' && (
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <h2>Closed Days</h2>
          <AdminClosedDays year={new Date().getFullYear()} month={new Date().getMonth()} darkMode={darkMode} />
        </div>
      )}
      {isAdmin && page === 'adminstats' && (
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <h2>All User Stats</h2>
          <AdminUserStats year={new Date().getFullYear()} month={new Date().getMonth()} darkMode={darkMode} isAdmin={isAdmin} />
        </div>
      )}
      {isAdmin && page === 'shiftconfig' && (
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          <h2>Shift Configuration</h2>
          <AdminShiftConfig darkMode={darkMode} />
        </div>
      )}
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
