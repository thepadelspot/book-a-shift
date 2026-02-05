
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
  if (loading) return <div>Loading...</div>;
  if (!user) return <LoginPage />;
  return (
    <div className="App">
      <Navbar onNavigate={setPage} currentPage={page} />
      {page === 'book' && <BookPage user={user} />}
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
