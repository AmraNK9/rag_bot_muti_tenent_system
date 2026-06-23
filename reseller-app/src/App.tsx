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
  business?: {
    id: number;
    name: string;
  };
}

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

  // Dashboard states
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [requests, setRequests] = useState<PlanRequest[]>([]);
  const [loadingDashboard, setLoadingDashboard] = useState(false);

  // Zoom Screenshot Modal
  const [zoomImgUrl, setZoomImgUrl] = useState<string | null>(null);

  // Top-up states
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
      if (dashData.success) {
        setStats(dashData.stats);
      }
      const reqData = await getRequests();
      if (reqData.success) {
        setRequests(reqData.requests || []);
      }
      const topupData = await getTopUpHistory();
      if (topupData.success) {
        setTopups(topupData.topups || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDashboard(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchDashboard();
    }
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
    reader.onloadend = () => {
      setTopupReceiptBase64(reader.result as string);
    };
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
        // Clear input file
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
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ fontSize: '3rem' }}>💸</div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '8px 0 2px' }}>Reseller Agent Portal</h1>
          <p style={{ fontSize: '0.82rem' }}>P2P Payment Routing & Subscriptions Manager</p>
        </div>

        <div className="card">
          <div className="auth-tabs">
            <button className={`auth-tab ${isLoginTab ? 'active' : ''}`} onClick={() => { setIsLoginTab(true); setAuthError(''); }}>Login</button>
            <button className={`auth-tab ${!isLoginTab ? 'active' : ''}`} onClick={() => { setIsLoginTab(false); setAuthError(''); }}>Register</button>
          </div>

          {authError && (
            <div style={{ padding: '8px 12px', background: 'rgba(239, 68, 68, 0.15)', color: 'var(--danger)', borderRadius: '6px', fontSize: '0.8rem', marginBottom: '16px' }}>
              ⚠️ {authError}
            </div>
          )}

          {isLoginTab ? (
            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label>Email Address</label>
                <input className="form-control" type="email" required placeholder="name@domain.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input className="form-control" type="password" required placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <button className="btn btn-primary" style={{ width: '100%', marginTop: '8px' }} type="submit" disabled={loadingAuth}>
                {loadingAuth ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister}>
              <div className="form-group">
                <label>Full Name</label>
                <input className="form-control" type="text" required placeholder="Aung Aung" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Email Address</label>
                <input className="form-control" type="email" required placeholder="aung@domain.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input className="form-control" type="password" required placeholder="Minimum 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <div className="form-group">
                <label>KBZ Pay Phone Number</label>
                <input className="form-control" type="text" required placeholder="09123456789" value={kpayNo} onChange={(e) => setKpayNo(e.target.value)} />
              </div>
              <div className="form-group">
                <label>KBZ Pay Account Name</label>
                <input className="form-control" type="text" required placeholder="U Aung Aung" value={kpayName} onChange={(e) => setKpayName(e.target.value)} />
              </div>
              <button className="btn btn-primary" style={{ width: '100%', marginTop: '8px' }} type="submit" disabled={loadingAuth}>
                {loadingAuth ? 'Creating Agent Account...' : 'Register as Reseller'}
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
      {/* HEADER */}
      <div className="header-bar">
        <div>
          <h1>💸 Reseller Portal</h1>
          <p>Welcome back, <strong>{stats?.name || 'Agent'}</strong> (Referral Code: {stats ? localStorage.getItem('reseller_token') ? JSON.parse(atob(localStorage.getItem('reseller_token')!.split('.')[1])).resellerId : '' : ''})</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={handleLogout}>Logout</button>
      </div>

      {/* METRICS */}
      {loadingDashboard && !stats ? (
        <div style={{ textAlign: 'center', padding: '40px' }}><div className="spinner" /> Loading dashboard...</div>
      ) : (
        <>
          <div className="metrics-grid">
            <div className="metric-card">
              <h3>{stats?.can_collect_payments ? 'Earned Balance' : 'Wallet Balance'}</h3>
              <div className="metric-card-val" style={{ color: 'var(--success)' }}>
                {stats?.balance ? Number(stats.balance).toLocaleString() : '0'} MMK
              </div>
              <p style={{ fontSize: '0.72rem', marginTop: '4px' }}>
                {stats?.can_collect_payments ? 'Commissions wallet balance' : 'Prepaid wallet credit balance'}
              </p>
            </div>

            <div className="metric-card">
              <h3>Daily Cash Collected</h3>
              <div className="metric-card-val">
                {stats?.totalCollected ? Number(stats.totalCollected).toLocaleString() : '0'} MMK
              </div>
              <p style={{ fontSize: '0.72rem', marginTop: '4px' }}>Total collections processed</p>
            </div>

            <div className="metric-card">
              <h3>Commission Rate</h3>
              <div className="metric-card-val">
                {stats?.commissionPercentage || '10'} %
              </div>
              <p style={{ fontSize: '0.72rem', marginTop: '4px' }}>Percentage per upgrade</p>
            </div>

            <div className="metric-card">
              <h3>Trust Rating</h3>
              <div className="metric-card-val" style={{ color: (stats?.reliabilityScore || 0) >= 80 ? 'var(--success)' : 'var(--primary)' }}>
                {stats?.reliabilityScore || '100'}/100
              </div>
              <p style={{ fontSize: '0.72rem', marginTop: '4px' }}>Collector reliability score</p>
            </div>

            <div className="metric-card">
              <h3>Total Referrals</h3>
              <div className="metric-card-val">
                {stats?.referredCount || '0'}
              </div>
              <p style={{ fontSize: '0.72rem', marginTop: '4px' }}>Referred client businesses</p>
            </div>
          </div>

          {/* APPROVAL QUEUE */}
          <div className="card">
            <h2>📥 Subscription Upgrade Requests ({requests.length})</h2>
            {requests.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '24px' }}>No pending subscription requests for your referrals.</p>
            ) : (
              <div className="requests-grid">
                {requests.map((req) => {
                  const isPrepaid = !stats?.can_collect_payments;
                  
                  // Calculate net required price after factoring in reseller commission overrides & reliability score
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
                          <span style={{ fontWeight: 'bold' }}>{req.business?.name || `Business #${req.business_id}`}</span>
                          <span className="badge badge-blue">{req.plan_name.toUpperCase()} Plan</span>
                        </div>
                        <div className="request-meta-row" style={{ marginTop: '4px', color: 'var(--text-muted)' }}>
                          <span>Amount: <strong>{req.price.toLocaleString()} MMK</strong></span>
                          <span>{new Date(req.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>

                      <img
                        className="request-screenshot"
                        src={req.screenshot_url}
                        alt="Payment Receipt Screenshot"
                        onClick={() => setZoomImgUrl(req.screenshot_url)}
                        onError={(e) => {
                          e.currentTarget.src = `http://localhost:3000${req.screenshot_url}`;
                        }}
                      />

                      {hasInsufficientBalance && (
                        <div style={{ color: 'var(--danger)', fontSize: '0.75rem', fontWeight: 'bold', textAlign: 'center', margin: '4px 0', padding: '6px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '6px' }}>
                          ⚠️ Insufficient balance. Net required: {Math.round(netRequiredPrice).toLocaleString()} MMK (Wallet: {Number(stats?.balance || 0).toLocaleString()} MMK).
                        </div>
                      )}

                      <div className="request-actions">
                        <button className="btn btn-ghost btn-sm" onClick={() => handleReject(req.id)}>Reject</button>
                        <button 
                          className="btn btn-success btn-sm" 
                          onClick={() => handleApprove(req.id)}
                          disabled={hasInsufficientBalance}
                        >
                          Approve
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* WALLET TOP-UP PANEL (PREPAID ONLY) */}
          {!stats?.can_collect_payments && (
            <div className="card" style={{ marginTop: '24px' }}>
              <h2>💼 Wallet Top-Up & Settlement</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
                {/* Form */}
                <div>
                  <h3 style={{ marginBottom: '12px' }}>Request Wallet Refill</h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                    To refill your wallet, transfer cash to the Super Admin's KBZ Pay number. 
                    Submit the amount paid and upload a screenshot of the receipt. The platform will credit your wallet at a discounted rate 
                    accounting for your <strong>{stats?.commissionPercentage || '30'}% commission</strong>!
                  </p>
                  
                  {topupStatusMsg.error && (
                    <div style={{ padding: '8px 12px', background: 'rgba(239, 68, 68, 0.15)', color: 'var(--danger)', borderRadius: '6px', fontSize: '0.8rem', marginBottom: '16px' }}>
                      ⚠️ {topupStatusMsg.error}
                    </div>
                  )}
                  {topupStatusMsg.success && (
                    <div style={{ padding: '8px 12px', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)', borderRadius: '6px', fontSize: '0.8rem', marginBottom: '16px' }}>
                      ✅ {topupStatusMsg.success}
                    </div>
                  )}

                  <form onSubmit={handleTopUpSubmit}>
                    <div className="form-group">
                      <label>Amount Paid (MMK)</label>
                      <input 
                        className="form-control" 
                        type="number" 
                        required 
                        placeholder="e.g. 14000" 
                        value={topupAmount} 
                        onChange={(e) => setTopupAmount(e.target.value)} 
                      />
                      {topupAmount && (
                        <div style={{ fontSize: '0.75rem', marginTop: '4px', color: 'var(--success)' }}>
                          Estimated credit: <strong>{Math.round(Number(topupAmount) / (1 - (Number(stats?.commissionPercentage || 30) / 100))).toLocaleString()} MMK</strong>
                        </div>
                      )}
                    </div>
                    <div className="form-group">
                      <label>KPay Receipt Screenshot</label>
                      <input 
                        id="topup-file-input"
                        className="form-control" 
                        type="file" 
                        accept="image/*" 
                        required 
                        onChange={handleFileChange} 
                      />
                    </div>
                    <button className="btn btn-primary" type="submit" disabled={submittingTopUp} style={{ width: '100%' }}>
                      {submittingTopUp ? 'Submitting request...' : 'Submit Top-up Request'}
                    </button>
                  </form>
                </div>

                {/* History */}
                <div>
                  <h3 style={{ marginBottom: '12px' }}>Top-Up History</h3>
                  {topups.length === 0 ? (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '24px' }}>
                      No top-up request history found.
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '320px', overflowY: 'auto', paddingRight: '8px' }}>
                      {topups.map((t) => (
                        <div key={t.id} style={{ padding: '12px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-glass)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>
                              Paid: {Number(t.amount_paid).toLocaleString()} MMK
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--success)', marginTop: '2px' }}>
                              Credit: +{Number(t.credit_amount).toLocaleString()} MMK
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                              {new Date(t.created_at).toLocaleString()}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button 
                              className="btn btn-ghost btn-xs" 
                              onClick={() => setZoomImgUrl(t.screenshot_url)}
                              style={{ padding: '4px 8px', fontSize: '0.7rem' }}
                            >
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
          <div className="modal-box" style={{ maxWidth: '450px', padding: '16px' }} onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setZoomImgUrl(null)}>&times;</button>
            <h3 style={{ marginBottom: '16px' }}>KPay Receipt Screenshot</h3>
            <img
              src={zoomImgUrl}
              alt="Zoomed Receipt"
              style={{ width: '100%', height: 'auto', borderRadius: '8px', border: '1px solid var(--border-glass)' }}
              onError={(e) => {
                e.currentTarget.src = `http://localhost:3000${zoomImgUrl}`;
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
