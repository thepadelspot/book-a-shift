
import './App.css';
import AuthProvider from './AuthProvider';
import AuthContext from './AuthContext';
import LoginPage from './LoginPage';
import React, { useContext, useState } from 'react';
import Navbar from './Navbar';
import BookPage from './BookPage';




const AppContent = () => {
  const { user, loading } = useContext(AuthContext);
  const [page, setPage] = useState('book');
  const [darkMode, setDarkMode] = useState(false);

  React.useEffect(() => {
    document.body.classList.toggle('dark-mode', darkMode);
  }, [darkMode]);

  if (loading) return <div>Loading...</div>;
  if (!user) return <LoginPage />;
  return (
    <div className={`App${darkMode ? ' dark-mode' : ''}`}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
        <button onClick={() => setDarkMode(d => !d)}>
          {darkMode ? 'Light Mode' : 'Dark Mode'}
        </button>
      </div>
      <Navbar onNavigate={setPage} currentPage={page} darkMode={darkMode} />
      {page === 'book' && <BookPage user={user} darkMode={darkMode} />}
      {page === 'myshifts' && <div>My Shifts page coming soon...</div>}
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
