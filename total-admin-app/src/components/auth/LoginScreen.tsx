import React, { useState } from 'react';

interface LoginScreenProps {
  setSecret: (secret: string | null) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ setSecret }) => {
  const [passcode, setPasscode] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcode.trim()) {
      localStorage.setItem('total_admin_secret', passcode.trim());
      setSecret(passcode.trim());
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-brand">
        <div className="auth-icon">🛡️</div>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, letterSpacing: '-0.3px', marginBottom: '6px' }}>
          Super Admin Console
        </h1>
        <p style={{ fontSize: '0.82rem' }}>SaaS Platform Global Management Console</p>
      </div>

      <div className="auth-card">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Admin Passcode</label>
            <input
              className="form-control"
              type="password"
              required
              placeholder="Enter global admin secret..."
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
            />
          </div>
          <button className="btn btn-primary" style={{ marginTop: '8px' }} type="submit">
            Enter Dashboard
          </button>
        </form>
      </div>
    </div>
  );
};
