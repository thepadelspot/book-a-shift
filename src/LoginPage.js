import React, { useState, useContext } from 'react';
import AuthContext from './AuthContext';
import verticalLogo from './assets/vertical.png';


const LoginPage = ({ darkMode }) => {
  const { login, loading } = useContext(AuthContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
    } catch (err) {
      setError('Login failed');
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className={`login-container${darkMode ? ' dark-mode' : ''}`}>
      <img src={verticalLogo} alt="Padel Spot Logo" style={{ width: '220px', margin: '0 auto', display: 'block', marginBottom: '1rem' }} />
      <h1>Shift Booking</h1>
      <h2>Sign In</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
        />
        <button type="submit" disabled={loading}>Login</button>
      </form>
      {error && <div className="error">{error}</div>}
    </div>
  );
};

export default LoginPage;
