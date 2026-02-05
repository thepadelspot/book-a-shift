
import React, { useState, useEffect } from 'react';
import AuthContext from './AuthContext';
import { supabase } from './supabaseClient';



const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('AuthProvider useEffect running');
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
      setLoading(false);
      // Insert user info into users table if not present
      if (session?.user) {
        console.log('Attempting upsert to users table:', session.user);
        supabase.from('users').upsert([
          { id: session.user.id, email: session.user.email }
        ], { onConflict: ['id'] })
        .then(({ error, data }) => {
          if (error) {
            console.error('User upsert error:', error);
          } else {
            console.log('User upsert success:', data);
          }
        });
      } else {
        console.log('No session.user in getSession');
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      // Insert user info into users table if not present
      if (session?.user) {
        console.log('Attempting upsert to users table (auth state change):', session.user);
        supabase.from('users').upsert([
          { id: session.user.id, email: session.user.email }
        ], { onConflict: ['id'] })
        .then(({ error, data }) => {
          if (error) {
            console.error('User upsert error (auth state change):', error);
          } else {
            console.log('User upsert success (auth state change):', data);
          }
        });
      } else {
        console.log('No session.user in onAuthStateChange');
      }
    });
    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const login = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    // user state will be set by the auth listener
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {console.log('AuthProvider rendering')}
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
