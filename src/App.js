
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
  if (loading) return <div>Loading...</div>;
  if (!user) return <LoginPage darkMode={darkMode} />;
  if (isAdminLoading) return <div>Loading...</div>;
  return (
    <div className={`App${darkMode ? ' dark-mode' : ''}`}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '0.5rem' }}>
        <img src={horizontalLogo} alt="Padel Spot Logo" style={{ height: '120px', marginBottom: '0.5rem' }} />
        <button
          className={`dark-mode-toggle${darkMode ? '' : ' light'}`}
          onClick={() => setDarkMode(d => !d)}
          aria-label="Toggle dark mode"
        >
          {darkMode ? '🌙' : '☀️'}
        </button>
      </div>
      <Navbar onNavigate={setPage} currentPage={page} darkMode={darkMode} isAdmin={isAdmin} />
      {page === 'book' && <BookPage user={user} darkMode={darkMode} />}
      {page === 'myshifts' && <MyShifts user={user} />}
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
