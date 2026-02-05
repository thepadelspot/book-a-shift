import React, { useState, useEffect } from 'react';
import AuthContext from './AuthContext';

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Placeholder for Supabase auth logic
  useEffect(() => {
    // TODO: Replace with Supabase auth listener
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    // TODO: Implement Supabase login
    setUser({ email });
  };

  const logout = async () => {
    // TODO: Implement Supabase logout
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
