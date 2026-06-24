import React, { useEffect, useState, useCallback } from 'react';
import {
  login as apiLogin,
  register as apiRegister,
  getDashboard,
  getRequests,
  approveRequest,
  rejectRequest,
  getTopUpHistory,
  submitTopUp,
} from './api/client';

interface DashboardStats {
  name: string;
  balance: number;
  totalCollected: number;
  commissionPercentage: number;
  reliabilityScore: number;
  referredCount: number;
  can_collect_payments: boolean;
  approverRate: number;
  referrerFirstRate: number;
  referrerRecRate: number;
  trustScoreFactor: number;
}

interface PlanRequest {
  id: number;
  business_id: number;
  plan_name: 'lite' | 'basic' | 'pro';
  screenshot_url: string;
  status: 'pending' | 'approved' | 'rejected';
  price: number;
  created_at: string;
  business?: { id: number; name: string };
}

// Resolve screenshot URL — use Vite proxy path (/uploads/…) when relative
const getImgSrc = (url: string) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return url.startsWith('/') ? url : `/${url}`;
};

// Safe onError: fallback to direct localhost:3000, then give up (no infinite loop)
const handleImgError = (e: React.SyntheticEvent<HTMLImageElement>, url: string) => {
  const img = e.currentTarget;
  if (img.dataset.fallbackTried) return;
  img.dataset.fallbackTried = '1';
  const base = url.startsWith('/') ? `http://localhost:3000${url}` : `http://localhost:3000/${url}`;
  img.src = base;
};

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('reseller_token'));
  const [isLoginTab, setIsLoginTab] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [kpayNo, setKpayNo] = useState('');
  const [kpayName, setKpayName] = useState('');
  const [authError, setAuthError] = useState('');
  const [loadingAuth, setLoadingAuth] = useState(false);

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [requests, setRequests] = useState<PlanRequest[]>([]);
  const [loadingDashboard, setLoadingDashboard] = useState(false);

  const [zoomImgUrl, setZoomImgUrl] = useState<string | null>(null);

  const [topups, setTopups] = useState<any[]>([]);
  const [topupAmount, setTopupAmount] = useState('');
  const [topupReceiptBase64, setTopupReceiptBase64] = useState('');
  const [submittingTopUp, setSubmittingTopUp] = useState(false);
  const [topupStatusMsg, setTopupStatusMsg] = useState({ error: '', success: '' });

  const fetchDashboard = useCallback(async () => {
    if (!token) return;
    setLoadingDashboard(true);
    try {
      const dashData = await getDashboard();
      if (dashData.success) setStats(dashData.stats);
      const reqData = await getRequests();
      if (reqData.success) setRequests(reqData.requests || []);
      const topupData = await getTopUpHistory();
      if (topupData.success) setTopups(topupData.topups || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDashboard(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) fetchDashboard();
  }, [token, fetchDashboard]);

  const handleLogin = async (e: React.FormEvent) => {
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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setLoadingAuth(true);
    try {
      const data = await apiRegister({ name, email, password, kpay_no: kpayNo, kpay_name: kpayName });
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

  const handleLogout = () => {
    localStorage.removeItem('reseller_token');
    setToken(null);
    setStats(null);
    setRequests([]);
  };

  const handleApprove = async (id: number) => {
    if (!confirm('Approve payment and upgrade client subscription plan?')) return;
    try {
      const res = await approveRequest(id);
      if (res.success) {
        alert('Plan purchase approved and applied successfully!');
        fetchDashboard();
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to approve request.');
    }
  };

  const handleReject = async (id: number) => {
    if (!confirm('Reject plan purchase request?')) return;
    try {
      const res = await rejectRequest(id);
      if (res.success) {
        alert('Request rejected.');
        fetchDashboard();
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to reject request.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setTopupReceiptBase64(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleTopUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTopupStatusMsg({ error: '', success: '' });
    if (!topupAmount || Number(topupAmount) <= 0) {
      setTopupStatusMsg({ error: 'Please enter a valid paid amount.', success: '' });
      return;
    }
    if (!topupReceiptBase64) {
      setTopupStatusMsg({ error: 'Please select a receipt image.', success: '' });
      return;
    }
    setSubmittingTopUp(true);
    try {
      const res = await submitTopUp(Number(topupAmount), topupReceiptBase64);
      if (res.success) {
        setTopupStatusMsg({ error: '', success: 'Top-up request submitted successfully!' });
        setTopupAmount('');
        setTopupReceiptBase64('');
        const fileInput = document.getElementById('topup-file-input') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
        fetchDashboard();
      }
    } catch (err: any) {
      setTopupStatusMsg({ error: err.response?.data?.error || 'Failed to submit top-up request.', success: '' });
    } finally {
      setSubmittingTopUp(false);
    }
  };

  // ─── AUTHENTICATION VIEW ─────────────────────────────────────────────────
  if (!token) {
    return (
      <div className="auth-wrapper">
        {/* Brand header */}
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
              onClick={() => { setIsLoginTab(true); setAuthError(''); }}
            >
              Sign In
            </button>
            <button
              className={`auth-tab ${!isLoginTab ? 'active' : ''}`}
              onClick={() => { setIsLoginTab(false); setAuthError(''); }}
            >
              Register
            </button>
          </div>

          {authError && (
            <div className="alert alert-error">⚠️ {authError}</div>
          )}

          {isLoginTab ? (
            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label>Email Address</label>
                <input className="form-control" type="email" required placeholder="name@domain.com"
                  value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input className="form-control" type="password" required placeholder="••••••••"
                  value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <button className="btn btn-primary" style={{ marginTop: '8px' }} type="submit" disabled={loadingAuth}>
                {loadingAuth ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister}>
              <div className="form-group">
                <label>Full Name</label>
                <input className="form-control" type="text" required placeholder="Aung Aung"
                  value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Email Address</label>
                <input className="form-control" type="email" required placeholder="aung@domain.com"
                  value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input className="form-control" type="password" required placeholder="Minimum 6 characters"
                  value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <div className="form-group">
                <label>KBZ Pay Phone Number</label>
                <input className="form-control" type="text" required placeholder="09123456789"
                  value={kpayNo} onChange={(e) => setKpayNo(e.target.value)} />
              </div>
              <div className="form-group">
                <label>KBZ Pay Account Name</label>
                <input className="form-control" type="text" required placeholder="U Aung Aung"
                  value={kpayName} onChange={(e) => setKpayName(e.target.value)} />
              </div>
              <button className="btn btn-primary" style={{ marginTop: '8px' }} type="submit" disabled={loadingAuth}>
                {loadingAuth ? 'Creating Account...' : 'Register as Reseller'}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // ─── MAIN PORTAL VIEW ────────────────────────────────────────────────────
  return (
    <div className="container">
      {/* STICKY HEADER */}
      <div className="header-bar">
        <div>
          <h1 style={{ fontSize: '1.1rem' }}>
            💸 {stats?.name || 'Reseller Portal'}
          </h1>
          <p style={{ fontSize: '0.78rem', marginTop: '2px' }}>
            {stats?.can_collect_payments ? 'Collector Agent' : 'Prepaid Agent'} · Commission {stats?.commissionPercentage || '—'}%
          </p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={handleLogout}>Logout</button>
      </div>

      {/* METRICS */}
      {loadingDashboard && !stats ? (
        <div className="loading-state"><div className="spinner" /> Loading dashboard...</div>
      ) : (
        <>
          <div className="metrics-grid">
            <div className="metric-card">
              <h3>{stats?.can_collect_payments ? 'Earned Balance' : 'Wallet Balance'}</h3>
              <div className="metric-card-val" style={{ color: 'var(--success)', fontSize: '1.3rem' }}>
                {stats?.balance ? Number(stats.balance).toLocaleString() : '0'}
              </div>
              <p style={{ fontSize: '0.7rem', marginTop: '4px' }}>MMK</p>
            </div>

            <div className="metric-card">
              <h3>Cash Collected</h3>
              <div className="metric-card-val" style={{ fontSize: '1.3rem' }}>
                {stats?.totalCollected ? Number(stats.totalCollected).toLocaleString() : '0'}
              </div>
              <p style={{ fontSize: '0.7rem', marginTop: '4px' }}>MMK total</p>
            </div>

            <div className="metric-card">
              <h3>Commission</h3>
              <div className="metric-card-val">{stats?.commissionPercentage || '10'}%</div>
              <p style={{ fontSize: '0.7rem', marginTop: '4px' }}>Per upgrade</p>
            </div>

            <div className="metric-card">
              <h3>Trust Score</h3>
              <div className="metric-card-val" style={{ color: (stats?.reliabilityScore || 0) >= 80 ? 'var(--success)' : 'var(--primary)' }}>
                {stats?.reliabilityScore || '100'}
              </div>
              <p style={{ fontSize: '0.7rem', marginTop: '4px' }}>/ 100</p>
            </div>

            <div className="metric-card">
              <h3>Referrals</h3>
              <div className="metric-card-val">{stats?.referredCount || '0'}</div>
              <p style={{ fontSize: '0.7rem', marginTop: '4px' }}>Clients referred</p>
            </div>
          </div>

          {/* APPROVAL QUEUE */}
          <div className="card">
            <h2>📥 Upgrade Requests
              <span style={{ marginLeft: '8px', fontSize: '0.78rem', fontWeight: 400, color: 'var(--text-muted)' }}>
                ({requests.length})
              </span>
            </h2>
            {requests.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--text-dim)' }}>
                <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📭</div>
                <p style={{ fontSize: '0.85rem' }}>No pending subscription requests.</p>
              </div>
            ) : (
              <div className="requests-grid">
                {requests.map((req) => {
                  const isPrepaid = !stats?.can_collect_payments;
                  const appRate = stats ? Number(stats.approverRate) : 10;
                  const reliability = stats ? Number(stats.reliabilityScore) : 100;
                  const trustFactor = stats ? Number(stats.trustScoreFactor) : 1.0;
                  const approverFee = Number(req.price) * (appRate / 100) * (reliability / 100) * trustFactor;
                  const netRequiredPrice = Number(req.price) - approverFee;
                  const hasInsufficientBalance = isPrepaid && Number(stats?.balance || 0) < netRequiredPrice;

                  return (
                    <div key={req.id} className="request-card">
                      <div>
                        <div className="request-meta-row">
                          <span style={{ fontWeight: 700 }}>{req.business?.name || `Business #${req.business_id}`}</span>
                          <span className="badge badge-blue">{req.plan_name.toUpperCase()}</span>
                        </div>
                        <div className="request-meta-row" style={{ marginTop: '4px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                          <span>{req.price.toLocaleString()} MMK</span>
                          <span>{new Date(req.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>

                      <img
                        className="request-screenshot"
                        src={getImgSrc(req.screenshot_url)}
                        alt="Payment Receipt"
                        onClick={() => setZoomImgUrl(req.screenshot_url)}
                        onError={(e) => handleImgError(e, req.screenshot_url)}
                      />

                      {hasInsufficientBalance && (
                        <div className="insufficient-balance-alert">
                          ⚠️ Insufficient balance. Need {Math.round(netRequiredPrice).toLocaleString()} MMK (have {Number(stats?.balance || 0).toLocaleString()} MMK)
                        </div>
                      )}

                      <div className="request-actions">
                        <button className="btn btn-ghost btn-sm" onClick={() => handleReject(req.id)}>Reject</button>
                        <button className="btn btn-success btn-sm" onClick={() => handleApprove(req.id)} disabled={hasInsufficientBalance}>
                          Approve
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* WALLET TOP-UP (PREPAID ONLY) */}
          {!stats?.can_collect_payments && (
            <div className="card">
              <h2>💼 Wallet Top-Up</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '24px' }}>
                {/* Form */}
                <div>
                  <h3 style={{ marginBottom: '10px', fontSize: '0.9rem' }}>Request Wallet Refill</h3>
                  <div className="wallet-info-box">
                    <p style={{ fontSize: '0.8rem', lineHeight: 1.5 }}>
                      Transfer cash to the Super Admin's KBZ Pay. Submit the amount and a receipt screenshot.
                      Your wallet will be credited at your <strong>{stats?.commissionPercentage || '30'}% commission rate</strong>.
                    </p>
                  </div>

                  {topupStatusMsg.error && (
                    <div className="alert alert-error" style={{ marginBottom: '12px' }}>⚠️ {topupStatusMsg.error}</div>
                  )}
                  {topupStatusMsg.success && (
                    <div className="alert alert-success" style={{ marginBottom: '12px' }}>✅ {topupStatusMsg.success}</div>
                  )}

                  <form onSubmit={handleTopUpSubmit}>
                    <div className="form-group">
                      <label>Amount Paid (MMK)</label>
                      <input className="form-control" type="number" required placeholder="e.g. 14000"
                        value={topupAmount} onChange={(e) => setTopupAmount(e.target.value)} />
                      {topupAmount && (
                        <div style={{ fontSize: '0.75rem', marginTop: '5px', color: 'var(--success)' }}>
                          Estimated credit: <strong>{Math.round(Number(topupAmount) / (1 - (Number(stats?.commissionPercentage || 30) / 100))).toLocaleString()} MMK</strong>
                        </div>
                      )}
                    </div>
                    <div className="form-group">
                      <label>KPay Receipt Screenshot</label>
                      <input id="topup-file-input" className="form-control" type="file" accept="image/*" required onChange={handleFileChange} />
                    </div>
                    <button className="btn btn-primary" type="submit" disabled={submittingTopUp}>
                      {submittingTopUp ? 'Submitting...' : 'Submit Top-up Request'}
                    </button>
                  </form>
                </div>

                {/* History */}
                <div>
                  <h3 style={{ marginBottom: '10px', fontSize: '0.9rem' }}>Top-Up History</h3>
                  {topups.length === 0 ? (
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-dim)', textAlign: 'center', padding: '20px 0' }}>
                      No top-up history yet.
                    </p>
                  ) : (
                    <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
                      {topups.map((t) => (
                        <div key={t.id} className="topup-history-item">
                          <div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                              {Number(t.amount_paid).toLocaleString()} MMK
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--success)', marginTop: '2px' }}>
                              +{Number(t.credit_amount).toLocaleString()} MMK credit
                            </div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', marginTop: '3px' }}>
                              {new Date(t.created_at).toLocaleString()}
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => setZoomImgUrl(t.screenshot_url)}
                              style={{ padding: '4px 10px', fontSize: '0.72rem', minHeight: '28px' }}>
                              View
                            </button>
                            <span className={`badge ${t.status === 'approved' ? 'badge-success' : t.status === 'rejected' ? 'badge-danger' : 'badge-warning'}`}>
                              {t.status.toUpperCase()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ZOOM IMAGE MODAL */}
      {zoomImgUrl && (
        <div className="modal-overlay" onClick={() => setZoomImgUrl(null)}>
          <div className="modal-box" style={{ maxWidth: '420px', padding: '16px' }} onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setZoomImgUrl(null)}>×</button>
            <h3 style={{ marginBottom: '14px' }}>KPay Receipt</h3>
            <img
              src={getImgSrc(zoomImgUrl)}
              alt="Zoomed Receipt"
              style={{ width: '100%', height: 'auto', maxHeight: '80vh', objectFit: 'contain', borderRadius: '8px', display: 'block' }}
              onError={(e) => handleImgError(e, zoomImgUrl)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
