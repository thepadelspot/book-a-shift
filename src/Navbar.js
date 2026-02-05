import React, { useContext } from 'react';
import AuthContext from './AuthContext';


const Navbar = ({ onNavigate, currentPage, darkMode, isAdmin }) => {
  const { logout, user } = useContext(AuthContext);

  if (!user) return null;

  return (
    <nav className={`navbar${darkMode ? ' dark-mode' : ''}`}>
      <button onClick={() => onNavigate('book')} className={`navbar-btn${darkMode ? ' dark-mode' : ''} ${currentPage === 'book' ? 'active' : ''}`}>Book</button>
      <button onClick={() => onNavigate('myshifts')} className={`navbar-btn${darkMode ? ' dark-mode' : ''} ${currentPage === 'myshifts' ? 'active' : ''}`}>My Shifts</button>
      {isAdmin && (
        <>
          <button onClick={() => onNavigate('closed')} className={`navbar-btn${darkMode ? ' dark-mode' : ''} ${currentPage === 'closed' ? 'active' : ''}`}>Closed Days</button>
          <button onClick={() => onNavigate('adminstats')} className={`navbar-btn${darkMode ? ' dark-mode' : ''} ${currentPage === 'adminstats' ? 'active' : ''}`}>User Stats</button>
        </>
      )}
      <button onClick={logout} className={`navbar-btn${darkMode ? ' dark-mode' : ''}`}>Logout</button>
    </nav>
  );
};

export default Navbar;
