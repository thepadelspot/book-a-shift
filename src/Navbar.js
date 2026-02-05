import React, { useContext } from 'react';
import AuthContext from './AuthContext';

const Navbar = ({ onNavigate, currentPage }) => {
  const { logout, user } = useContext(AuthContext);

  if (!user) return null;

  return (
    <nav className="navbar">
      <button onClick={() => onNavigate('book')} className={currentPage === 'book' ? 'active' : ''}>Book</button>
      <button onClick={() => onNavigate('myshifts')} className={currentPage === 'myshifts' ? 'active' : ''}>My Shifts</button>
      <button onClick={logout}>Logout</button>
    </nav>
  );
};

export default Navbar;
