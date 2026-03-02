
import React, { useState, useEffect } from 'react';
import AuthContext from './AuthContext';
import { supabase } from './supabaseClient';



const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAndSetUser(sessionUser) {
      if (!sessionUser) {
        setUser(null);
        setLoading(false);
        return;
      }
      // Upsert user info
      await supabase.from('users').upsert([
        { id: sessionUser.id, email: sessionUser.email }
      ], { onConflict: ['id'] });
      // Fetch profile info
      const { data: profile } = await supabase
        .from('users')
        .select('firstName, lastName')
        .eq('id', sessionUser.id)
        .single();
      setUser({ ...sessionUser, ...profile });
      setLoading(false);
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      fetchAndSetUser(session?.user);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      fetchAndSetUser(session?.user);
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
