import React, { useState } from 'react';
import { login as apiLogin, register as apiRegister } from '../../api/client';

interface AuthScreenProps {
  setToken: (token: string | null) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ setToken }) => {
  const [isLoginTab, setIsLoginTab] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [kpayNo, setKpayNo] = useState('');
  const [kpayName, setKpayName] = useState('');
  const [authError, setAuthError] = useState('');
  const [loadingAuth, setLoadingAuth] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setLoadingAuth(true);
    try {
      const data = await apiLogin(email, password);
      if (data.success && data.token) {
        localStorage.setItem('reseller_token', data.token);
        setToken(data.token);
      }
    } catch (err: any) {
      setAuthError(err.response?.data?.error || 'Invalid credentials');
    } finally {
      setLoadingAuth(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setLoadingAuth(true);
    try {
      const data = await apiRegister({
        name,
        email,
        password,
        kpay_no: kpayNo,
        kpay_name: kpayName,
      });
      if (data.success && data.token) {
        localStorage.setItem('reseller_token', data.token);
        setToken(data.token);
      }
    } catch (err: any) {
      setAuthError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoadingAuth(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-brand">
        <div className="auth-icon">💸</div>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, letterSpacing: '-0.3px', marginBottom: '6px' }}>
          Reseller Portal
        </h1>
        <p style={{ fontSize: '0.82rem' }}>P2P Payment Routing & Subscription Manager</p>
      </div>

      <div className="auth-card">
        <div className="auth-tabs">
          <button
            className={`auth-tab ${isLoginTab ? 'active' : ''}`}
            onClick={() => {
              setIsLoginTab(true);
              setAuthError('');
            }}
          >
            Sign In
          </button>
          <button
            className={`auth-tab ${!isLoginTab ? 'active' : ''}`}
            onClick={() => {
              setIsLoginTab(false);
              setAuthError('');
            }}
          >
            Register
          </button>
        </div>

        {authError && <div className="alert alert-error">⚠️ {authError}</div>}

        {isLoginTab ? (
          <form onSubmit={handleLoginSubmit}>
            <div className="form-group">
              <label>Email Address</label>
              <input
                className="form-control"
                type="email"
                required
                placeholder="name@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input
                className="form-control"
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button
              className="btn btn-primary"
              style={{ marginTop: '8px' }}
              type="submit"
              disabled={loadingAuth}
            >
              {loadingAuth ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegisterSubmit}>
            <div className="form-group">
              <label>Full Name</label>
              <input
                className="form-control"
                type="text"
                required
                placeholder="Aung Aung"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Email Address</label>
              <input
                className="form-control"
                type="email"
                required
                placeholder="aung@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input
                className="form-control"
                type="password"
                required
                placeholder="Minimum 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>KBZ Pay Phone Number</label>
              <input
                className="form-control"
                type="text"
                required
                placeholder="09123456789"
                value={kpayNo}
                onChange={(e) => setKpayNo(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>KBZ Pay Account Name</label>
              <input
                className="form-control"
                type="text"
                required
                placeholder="U Aung Aung"
                value={kpayName}
                onChange={(e) => setKpayName(e.target.value)}
              />
            </div>
            <button
              className="btn btn-primary"
              style={{ marginTop: '8px' }}
              type="submit"
              disabled={loadingAuth}
            >
              {loadingAuth ? 'Creating Account...' : 'Register as Reseller'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
