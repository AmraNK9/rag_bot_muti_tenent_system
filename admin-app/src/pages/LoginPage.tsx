import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { login } from '../api/client';

export default function LoginPage() {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { loginUser } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await login(name, password);
      loginUser(data.token, data.business);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="login-logo-icon">🤖</div>
          <div className="login-title">ChatBot Admin</div>
          <div className="login-subtitle">Manage your chatbots & knowledge base</div>
        </div>

        <form onSubmit={handleSubmit}>
          {error && <div className="login-error">⚠️ {error}</div>}

          <div className="form-group">
            <label className="form-label">Business Name</label>
            <input
              id="login-name"
              className="form-input"
              type="text"
              placeholder="Your business name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              id="login-password"
              className="form-input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            id="login-submit"
            className="btn btn-primary w-full"
            type="submit"
            disabled={loading}
          >
            {loading ? <><div className="spinner" /> Signing in...</> : '🔐 Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
