import React, { useContext } from 'react';
import AuthContext from './AuthContext';


const Navbar = ({ onNavigate, currentPage, darkMode, isAdmin }) => {
  const { logout, user } = useContext(AuthContext);

  if (!user) return null;

  const navButtons = [
    <button key="book" onClick={() => onNavigate('book')} className={`navbar-btn${darkMode ? ' dark-mode' : ''} ${currentPage === 'book' ? 'active' : ''}`}>Book</button>,
    <button key="myshifts" onClick={() => onNavigate('myshifts')} className={`navbar-btn${darkMode ? ' dark-mode' : ''} ${currentPage === 'myshifts' ? 'active' : ''}`}>My Shifts</button>,
    ...(isAdmin ? [
      <button key="closed" onClick={() => onNavigate('closed')} className={`navbar-btn${darkMode ? ' dark-mode' : ''} ${currentPage === 'closed' ? 'active' : ''}`}>Closed Days</button>,
      <button key="adminstats" onClick={() => onNavigate('adminstats')} className={`navbar-btn${darkMode ? ' dark-mode' : ''} ${currentPage === 'adminstats' ? 'active' : ''}`}>User Stats</button>
    ] : []),
    <button key="logout" onClick={logout} className={`navbar-btn${darkMode ? ' dark-mode' : ''}`}>Logout</button>
  ];
  return (
    <nav className={`navbar${darkMode ? ' dark-mode' : ''} ${isAdmin ? ' scrollable-navbar' : ' center-navbar'}`}>
      {navButtons}
      {isAdmin && <div className="navbar-fade-right" />}
    </nav>
  );
};

export default Navbar;
