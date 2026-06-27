import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { login as apiLogin, registerStandalone } from '../../api/client';

export const LoginScreen: React.FC = () => {
  const { login } = useAuth();

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref') || params.get('referralCode');
    if (ref) {
      setReferralCode(ref);
      setIsLogin(false);
    }
  }, []);

  const switchTab = (toLogin: boolean) => {
    setIsLogin(toLogin);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      let data;
      if (isLogin) {
        data = await apiLogin(email, password);
      } else {
        data = await registerStandalone({ name, email, password, referralCode });
      }
      if (data.success && data.token) {
        login(data.token);
      } else {
        setError(data.error || (isLogin ? 'Login failed' : 'Registration failed'));
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-hero">
        <div className="auth-logo-wrap">🤖</div>
        <h1>Chatbot Admin</h1>
        <p>AI Chatbot ကို ၅ မိနစ်အတွင်း ချိတ်ဆက်ပြီး Customer ဖြေကြားမှုကို အလိုအလျောက် ပြုလုပ်ပါ</p>
      </div>

      <div className="auth-body">
        <div className="auth-tabs">
          <button className={`auth-tab ${isLogin ? 'active' : ''}`} onClick={() => switchTab(true)}>
            Sign In
          </button>
          <button className={`auth-tab ${!isLogin ? 'active' : ''}`} onClick={() => switchTab(false)}>
            Register
          </button>
        </div>

        {error && <div className="alert-box alert-error">⚠️ {error}</div>}

        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <div className="form-group">
              <label>Full Name</label>
              <input
                type="text"
                placeholder="Your name"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>
          )}

          <div className="form-group">
            <label>Email Address</label>
            <input
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                style={{ paddingRight: 44 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                style={{
                  position: 'absolute', right: 12, top: '50%',
                  transform: 'translateY(-50%)', background: 'none',
                  border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                  fontSize: '0.85rem', padding: 4, fontFamily: 'inherit'
                }}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {!isLogin && (
            <div className="form-group">
              <label>Referral Code <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(Optional)</span></label>
              <input
                type="text"
                placeholder="Enter referral code"
                value={referralCode}
                onChange={e => setReferralCode(e.target.value)}
              />
            </div>
          )}

          <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: 4 }}>
            {loading ? <><div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> Processing...</> : isLogin ? 'Sign In' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
};
