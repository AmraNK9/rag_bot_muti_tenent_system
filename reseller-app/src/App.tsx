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
  getRequestsHistory,
  verifyTopupId,
  submitP2PTopup,
  getPlans,
  getP2PHistory,
} from './api/client';

interface DashboardStats {
  id?: number;
  name: string;
  balance: number;
  prepaid_balance: number;
  pending_debt: number;
  postpaid_limit: number;
  can_sell: boolean;
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
  const [requests, setRequests] = useState<any[]>([]);
  const [requestHistory, setRequestHistory] = useState<any[]>([]);
  const [loadingDashboard, setLoadingDashboard] = useState(false);

  const [zoomImgUrl, setZoomImgUrl] = useState<string | null>(null);

  const [topups, setTopups] = useState<any[]>([]);
  const [topupAmount, setTopupAmount] = useState('');
  const [topupReceiptBase64, setTopupReceiptBase64] = useState('');
  const [topupType, setTopupType] = useState<'prepaid_topup' | 'postpaid_settlement'>('prepaid_topup');
  const [submittingTopUp, setSubmittingTopUp] = useState(false);
  const [topupStatusMsg, setTopupStatusMsg] = useState({ error: '', success: '' });
  const [activeTab, setActiveTab] = useState<'dashboard' | 'p2p' | 'wallet' | 'history'>('dashboard');
  const [historySubTab, setHistorySubTab] = useState<'approvals' | 'p2p'>('approvals');
  const [drawerOpen, setDrawerOpen] = useState(false);

  // ─── P2P TOPUP STATE ───
  const [p2pTopupId, setP2pTopupId] = useState('');
  const [p2pVerifiedName, setP2pVerifiedName] = useState<string | null>(null);
  const [p2pSelectedPackage, setP2pSelectedPackage] = useState<any>(null);
  const [p2pLoading, setP2pLoading] = useState(false);
  const [p2pStatusMsg, setP2pStatusMsg] = useState({ error: '', success: '' });
  const [p2pPackages, setP2pPackages] = useState<any[]>([]);
  const [p2pHistory, setP2pHistory] = useState<any[]>([]);

  const fetchPlans = useCallback(async () => {
    try {
      const res = await getPlans();
      if (res.success && res.plans) {
        setP2pPackages(res.plans);
      }
    } catch (e) {
      console.error('Failed to fetch plans', e);
    }
  }, []);

  const fetchDashboard = useCallback(async () => {
    if (!token) return;
    setLoadingDashboard(true);
    try {
      const dashData = await getDashboard();
      if (dashData.success) setStats(dashData.stats);
      const [reqData, histData, p2pHistData] = await Promise.all([
        getRequests(),
        getRequestsHistory(),
        getP2PHistory()
      ]);
      if (reqData.success) setRequests(reqData.requests || []);
      if (histData.success) setRequestHistory(histData.requests || []);
      if (p2pHistData.success) setP2pHistory(p2pHistData.history || []);
      const topupData = await getTopUpHistory();
      if (topupData.success) setTopups(topupData.topups || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDashboard(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchDashboard();
      fetchPlans();
    }
  }, [token, fetchDashboard, fetchPlans]);

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
    setTopupStatusMsg({ error: '', success: '' });
    try {
      // Basic validation format (e.g. 1000 for 100 credits) -> default 10:1 mapping
      const credits = Math.floor(Number(topupAmount) / 10);
      await submitTopUp(Number(topupAmount), credits, topupType, topupReceiptBase64);
      setTopupStatusMsg({ error: '', success: 'Top-up request submitted successfully! Pending admin approval.' });
      setTopupAmount('');
      setTopupReceiptBase64('');
      fetchDashboard();
    } catch (err: any) {
      setTopupStatusMsg({ error: err.response?.data?.error || 'Failed to submit request', success: '' });
    } finally {
      setSubmittingTopUp(false);
    }
  };

  // ─── P2P HANDLERS ───
  const handleVerifyP2PId = async () => {
    if (!p2pTopupId.trim()) return;
    setP2pLoading(true);
    setP2pStatusMsg({ error: '', success: '' });
    try {
      const res = await verifyTopupId(p2pTopupId.trim());
      if (res.success) {
        setP2pVerifiedName(res.maskedName);
      }
    } catch (err: any) {
      setP2pVerifiedName(null);
      setP2pStatusMsg({ error: err.response?.data?.error || 'User not found.', success: '' });
    } finally {
      setP2pLoading(false);
    }
  };

  const handleP2PSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('handleP2PSubmit called with:', { p2pTopupId, p2pSelectedPackage });
    if (!p2pTopupId || !p2pSelectedPackage) {
      console.warn('p2pTopupId or p2pSelectedPackage is missing');
      return;
    }
    setP2pLoading(true);
    setP2pStatusMsg({ error: '', success: '' });
    try {
      const priceVal = Number(p2pSelectedPackage.price);
      console.log('Submitting P2P Top-up:', { topupId: p2pTopupId.trim(), price: priceVal, queryLimit: p2pSelectedPackage.query_limit });
      const res = await submitP2PTopup(p2pTopupId.trim(), priceVal, p2pSelectedPackage.query_limit);
      console.log('P2P Top-up response:', res);
      if (res.success) {
        setP2pStatusMsg({ error: '', success: `Top-up successful! Commission earned: ${res.commissionEarned} MMK` });
        setP2pVerifiedName(null);
        setP2pTopupId('');
        setP2pSelectedPackage(null);
        fetchDashboard();
      }
    } catch (err: any) {
      console.error('P2P Top-up execution failed:', err);
      setP2pStatusMsg({ error: err.response?.data?.error || 'Top-up failed.', success: '' });
    } finally {
      setP2pLoading(false);
    }
  };

  // ─── AUTHENTICATION VIEW ─────────────────────────────────────────────────────────────────────────────────────────
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
    <>
      {/* ─── APP BAR ─── */}
      <div className="app-bar">
        <button className="app-bar-icon-btn" onClick={() => setDrawerOpen(true)}>
          ☰
        </button>
        <div className="app-bar-title">
          {activeTab === 'dashboard' && 'Dashboard'}
          {activeTab === 'p2p' && 'Direct Top-Up'}
          {activeTab === 'wallet' && 'Wallet'}
          {activeTab === 'history' && 'History'}
        </div>
        <div style={{ width: '40px' }} /> {/* Placeholder for balance */}
      </div>

      {/* ─── DRAWER (SIDEBAR) ─── */}
      {drawerOpen && (
        <div className="drawer-overlay" onClick={() => setDrawerOpen(false)}>
          <div className="drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Menu</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setDrawerOpen(false)} style={{ padding: '4px 8px' }}>✕</button>
            </div>
            
            <div className="drawer-profile">
              <div className="drawer-profile-icon">
                {stats?.name?.charAt(0).toUpperCase() || 'R'}
              </div>
              <h3 style={{ margin: 0 }}>{stats?.name || 'Reseller'}</h3>
              <p style={{ fontSize: '0.8rem', marginTop: '4px' }}>
                {stats?.can_collect_payments ? 'Postpaid Collector' : 'Prepaid Agent'}
              </p>
            </div>

            <div className="drawer-item">
              <span className="drawer-item-label">Commission Rate</span>
              <span className="drawer-item-val">{stats?.commissionPercentage || '—'}%</span>
            </div>
            {stats?.can_collect_payments && (
              <div className="drawer-item">
                <span className="drawer-item-label">Postpaid Limit</span>
                <span className="drawer-item-val">{stats?.postpaid_limit ? Number(stats.postpaid_limit).toLocaleString() : '0'} MMK</span>
              </div>
            )}
            <div className="drawer-item">
              <span className="drawer-item-label">Trust Score</span>
              <span className="drawer-item-val" style={{ color: (stats?.reliabilityScore || 0) >= 80 ? 'var(--success)' : 'var(--warning)' }}>
                {stats?.reliabilityScore || '100'}/100
              </span>
            </div>
            <div className="drawer-item">
              <span className="drawer-item-label">Referrals</span>
              <span className="drawer-item-val">{stats?.referredCount || '0'} clients</span>
            </div>

            <div style={{ marginTop: '32px' }}>
              <div className="drawer-item-label" style={{ marginBottom: '8px' }}>Your Referral Link</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input className="form-control" readOnly value={`https://app.example.com/ref/${stats?.id || '0'}`} style={{ minHeight: '36px', padding: '8px', fontSize: '0.75rem' }} />
                <button className="btn btn-ghost btn-sm" onClick={() => alert('Link copied!')} style={{ minHeight: '36px' }}>Copy</button>
              </div>
            </div>

            <div style={{ marginTop: 'auto', paddingTop: '24px' }}>
              <button className="btn btn-danger" style={{ width: '100%' }} onClick={handleLogout}>
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="container">
        {/* COMPACT WALLET STRIP (Visible on Dashboard) */}
        {activeTab === 'dashboard' && (
          <div className="compact-wallet-strip animate-slide-up">
            <div className="wallet-chip">
              <div className="wallet-chip-label">Commission</div>
              <div className="wallet-chip-val" style={{ color: 'var(--success)' }}>
                {stats?.balance ? Number(stats.balance).toLocaleString() : '0'}
              </div>
            </div>

            {!stats?.can_collect_payments ? (
              <div className="wallet-chip">
                <div className="wallet-chip-label">Prepaid Wallet</div>
                <div className="wallet-chip-val" style={{ color: 'var(--primary)' }}>
                  {stats?.prepaid_balance ? Number(stats.prepaid_balance).toLocaleString() : '0'}
                </div>
              </div>
            ) : (
              <div className="wallet-chip" style={ (stats?.pending_debt || 0) >= (stats?.postpaid_limit || 0) ? { border: '1px solid rgba(239, 68, 68, 0.4)' } : {} }>
                <div className="wallet-chip-label" style={{ color: (stats?.pending_debt || 0) > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                  Pending Debt
                </div>
                <div className="wallet-chip-val" style={{ color: (stats?.pending_debt || 0) > 0 ? 'var(--danger)' : 'var(--success)' }}>
                  {stats?.pending_debt ? Number(stats.pending_debt).toLocaleString() : '0'}
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Limit: {stats?.postpaid_limit?.toLocaleString()} MMK
                </div>
              </div>
            )}
          </div>
        )}

      {/* DASHBOARD TAB */}
      {activeTab === 'dashboard' && (
        <>
          {loadingDashboard && !stats ? (
            <div className="loading-state"><div className="spinner" /> Loading dashboard...</div>
          ) : (
            <>

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
                  const appRate = stats ? Number(stats.approverRate) : 10;
                  const reliability = stats ? Number(stats.reliabilityScore) : 100;
                  const trustFactor = stats ? Number(stats.trustScoreFactor) : 1.0;
                  const approverFee = Number(req.price) * (appRate / 100) * (reliability / 100) * trustFactor;
                  const netRequiredPrice = Number(req.price) - approverFee;
                  
                  const canCoverPrepaid = Number(stats?.prepaid_balance || 0) >= netRequiredPrice;
                  const canCoverPostpaid = (Number(stats?.pending_debt || 0) + netRequiredPrice) <= Number(stats?.postpaid_limit || 0);
                  const hasInsufficientBalance = !canCoverPrepaid && !canCoverPostpaid;
                  const isSuspended = !(stats?.can_sell);

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

                      {isSuspended && (
                        <div className="insufficient-balance-alert">
                          ⚠️ Account Suspended: Please settle pending debts to continue selling.
                        </div>
                      )}
                      {!isSuspended && hasInsufficientBalance && (
                        <div className="insufficient-balance-alert">
                          ⚠️ Insufficient limit. Need {Math.round(netRequiredPrice).toLocaleString()} MMK (Prepaid: {Number(stats?.prepaid_balance || 0).toLocaleString()}, Debt: {Number(stats?.pending_debt || 0).toLocaleString()} / {Number(stats?.postpaid_limit || 0).toLocaleString()})
                        </div>
                      )}

                      <div className="request-actions">
                        <button className="btn btn-ghost btn-sm" onClick={() => handleReject(req.id)}>Reject</button>
                        <button className="btn btn-success btn-sm" onClick={() => handleApprove(req.id)} disabled={hasInsufficientBalance || isSuspended}>
                          Approve
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </>
  )}

      {/* HISTORY TAB */}
      {activeTab === 'history' && (
        <div className="card animate-slide-up" style={{ padding: '24px 20px' }}>
          <h2 style={{ marginBottom: '20px' }}>📜 History Records</h2>

          {/* Sub-tab navigation */}
          <div className="auth-tabs" style={{ marginBottom: '24px', display: 'flex', gap: '8px' }}>
            <button
              className={`auth-tab ${historySubTab === 'approvals' ? 'active' : ''}`}
              onClick={() => setHistorySubTab('approvals')}
              style={{ flex: 1, padding: '10px', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
            >
              Subscription Approvals
            </button>
            <button
              className={`auth-tab ${historySubTab === 'p2p' ? 'active' : ''}`}
              onClick={() => setHistorySubTab('p2p')}
              style={{ flex: 1, padding: '10px', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
            >
              P2P Direct Top-Ups
            </button>
          </div>

          {/* Subscription Approvals Sub-tab */}
          {historySubTab === 'approvals' && (
            <>
              <h3 style={{ marginBottom: '16px', fontSize: '1.05rem', color: 'var(--text-muted)' }}>📋 Handled Subscription Upgrades</h3>
              {requestHistory.length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No handled requests found.</p>
              ) : (
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Business</th>
                        <th>Plan Requested</th>
                        <th>Price</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {requestHistory.map((item, idx) => (
                        <tr key={idx}>
                          <td>{new Date(item.created_at).toLocaleDateString()}</td>
                          <td style={{ fontWeight: 600 }}>{item.business?.name || `Business #${item.business_id}`}</td>
                          <td style={{ textTransform: 'uppercase' }}>{item.plan_name}</td>
                          <td>{item.price?.toLocaleString()} MMK</td>
                          <td>
                            {item.status === 'approved' && <span className="badge badge-green">Approved</span>}
                            {item.status === 'rejected' && <span className="badge badge-red">Rejected</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* P2P Direct Top-Ups Sub-tab */}
          {historySubTab === 'p2p' && (
            <>
              <h3 style={{ marginBottom: '16px', fontSize: '1.05rem', color: 'var(--text-muted)' }}>💎 Direct P2P Top-Up History</h3>
              {p2pHistory.length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No P2P top-up transactions found.</p>
              ) : (
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Business Name (Top-Up ID)</th>
                        <th>Price Paid</th>
                        <th>Queries Added</th>
                        <th>Commission Earned</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p2pHistory.map((item, idx) => (
                        <tr key={idx}>
                          <td>{new Date(item.created_at).toLocaleString()}</td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{item.business?.name || `Business #${item.business_id}`}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.business?.topup_id || '—'}</div>
                          </td>
                          <td style={{ fontWeight: 'bold' }}>{Number(item.package_price).toLocaleString()} MMK</td>
                          <td style={{ color: 'var(--primary)', fontWeight: 600 }}>+{Number(item.credit_amount).toLocaleString()}</td>
                          <td style={{ color: 'var(--success)', fontWeight: 'bold' }}>+{Number(item.commission_earned).toLocaleString()} MMK</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* P2P TOPUP TAB */}
      {activeTab === 'p2p' && (
        <div className="card animate-fade-in" style={{ padding: '24px 20px', minHeight: '60vh' }}>
          <h2 style={{ marginBottom: '16px', fontSize: '1.3rem' }}>💎 P2P Direct Top-Up</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '24px' }}>
            Top up AI Query Credits directly for your client's Business using their Unique Top-Up ID.
          </p>

          {/* Verification Step */}
          <div className="form-group">
            <label>Business Top-Up ID</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                className="form-control"
                type="text"
                placeholder="UID-XXXXXX"
                value={p2pTopupId}
                onChange={(e) => {
                  setP2pTopupId(e.target.value);
                  setP2pVerifiedName(null);
                  setP2pStatusMsg({ error: '', success: '' });
                }}
              />
              <button className="btn btn-secondary" onClick={handleVerifyP2PId} disabled={p2pLoading || !p2pTopupId.trim()}>
                {p2pLoading && !p2pVerifiedName ? '...' : 'Verify'}
              </button>
            </div>
          </div>

          {p2pStatusMsg.error && <div className="alert alert-danger" style={{ marginTop: '16px' }}>{p2pStatusMsg.error}</div>}
          {p2pStatusMsg.success && <div className="alert alert-success" style={{ marginTop: '16px' }}>{p2pStatusMsg.success}</div>}

          {/* Submission Step */}
          {p2pVerifiedName && (
            <form onSubmit={handleP2PSubmit} className="animate-slide-up" style={{ marginTop: '24px', padding: '16px', background: 'var(--bg-main)', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                  {p2pVerifiedName.charAt(0)}
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Verified Business</div>
                  <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{p2pVerifiedName}</div>
                </div>
              </div>

              <div className="form-group" style={{ marginTop: '20px' }}>
                <label>Select Top-Up Package</label>
                <div className="requests-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', marginTop: '8px' }}>
                  {p2pPackages.map(pkg => (
                    <div 
                      key={pkg.id} 
                      className="request-card" 
                      style={{ cursor: 'pointer', padding: '12px', border: p2pSelectedPackage?.id === pkg.id ? '2px solid var(--primary)' : '1px solid var(--border)', background: p2pSelectedPackage?.id === pkg.id ? 'rgba(37, 99, 235, 0.05)' : 'var(--bg-card)' }}
                      onClick={() => setP2pSelectedPackage(pkg)}
                    >
                      <div style={{ fontWeight: 'bold', fontSize: '0.9rem', textTransform: 'uppercase' }}>{pkg.name}</div>
                      <div style={{ color: 'var(--primary)', fontWeight: 'bold', marginTop: '4px' }}>{Number(pkg.price).toLocaleString()} MMK</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>+{pkg.query_limit.toLocaleString()} Queries</div>
                    </div>
                  ))}
                </div>
              </div>

              <button 
                type="submit"
                className="btn btn-primary" 
                style={{ width: '100%', marginTop: '24px', padding: '12px', fontSize: '1rem' }} 
                disabled={p2pLoading || !p2pSelectedPackage}
              >
                {p2pLoading ? 'Processing...' : p2pSelectedPackage ? `Confirm Top-Up (${Number(p2pSelectedPackage.price).toLocaleString()} MMK)` : 'Select a Package'}
              </button>
            </form>
          )}
        </div>
      )}

      {/* WALLET TAB */}
      {activeTab === 'wallet' && (
        <>
          <div className="metrics-grid" style={{ marginBottom: '16px' }}>
            <div className="metric-card">
              <div className="metric-icon-bg">📈</div>
              <h3>Commission Balance</h3>
              <div className="metric-card-val" style={{ color: 'var(--success)' }}>
                {stats?.balance ? Number(stats.balance).toLocaleString() : '0'}
              </div>
            </div>

            {!stats?.can_collect_payments ? (
              <div className="metric-card">
                <div className="metric-icon-bg" style={{ background: 'var(--primary-glow)' }}>💳</div>
                <h3>Prepaid Wallet</h3>
                <div className="metric-card-val" style={{ color: 'var(--primary)' }}>
                  {stats?.prepaid_balance ? Number(stats.prepaid_balance).toLocaleString() : '0'}
                </div>
              </div>
            ) : (
              <div className="metric-card" style={ (stats?.pending_debt || 0) >= (stats?.postpaid_limit || 0) ? { border: '1px solid var(--danger)' } : {} }>
                <div className="metric-icon-bg" style={{ background: (stats?.pending_debt || 0) > 0 ? 'var(--danger-glow)' : 'var(--success-glow)' }}>⚖️</div>
                <h3>Pending Debt</h3>
                <div className="metric-card-val" style={{ color: (stats?.pending_debt || 0) > 0 ? 'var(--danger)' : 'var(--success)' }}>
                  {stats?.pending_debt ? Number(stats.pending_debt).toLocaleString() : '0'}
                </div>
                <p style={{ fontSize: '0.75rem', marginTop: '6px' }}>Limit: {stats?.postpaid_limit?.toLocaleString()} MMK</p>
              </div>
            )}
          </div>

          {/* WALLET TOP-UP / SETTLEMENT */}
          <div className="card animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <h2 style={{ margin: 0 }}>
                {stats?.can_collect_payments ? '⚖️ Settle Pending Debt' : '💳 Wallet Top-Up'}
              </h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '32px' }}>
              {/* Form */}
              <div>
                <h3 style={{ marginBottom: '12px', fontSize: '0.95rem' }}>Submit Transfer Receipt</h3>
                <div className="wallet-info-box">
                  <p style={{ fontSize: '0.85rem', lineHeight: 1.6 }}>
                    {stats?.can_collect_payments 
                      ? "Transfer cash to the Super Admin's KBZ Pay to clear your pending debt. Submit the exact amount paid and a receipt screenshot."
                      : "Transfer cash to the Super Admin's KBZ Pay to refill your prepaid wallet. Submit the amount and a receipt screenshot."}
                  </p>
                </div>

                {topupStatusMsg.error && (
                  <div className="alert alert-error" style={{ marginBottom: '16px' }}>⚠️ {topupStatusMsg.error}</div>
                )}
                {topupStatusMsg.success && (
                  <div className="alert alert-success" style={{ marginBottom: '16px' }}>✅ {topupStatusMsg.success}</div>
                )}

                <form onSubmit={(e) => {
                  // Override topup type just in case before submit
                  if (stats) {
                    setTopupType(stats.can_collect_payments ? 'postpaid_settlement' : 'prepaid_topup');
                  }
                  handleTopUpSubmit(e);
                }}>
                  <div className="form-group">
                    <label>Amount Paid (MMK)</label>
                    <input className="form-control" type="number" required placeholder="e.g. 14000"
                      value={topupAmount} onChange={(e) => setTopupAmount(e.target.value)} />
                      {topupAmount && !stats?.can_collect_payments && (
                        <div style={{ fontSize: '0.8rem', marginTop: '8px', color: 'var(--success)' }}>
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
      
        {/* ─── BOTTOM NAVIGATION ─── */}
        <div className="bottom-nav">
          <button className={`bottom-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
            <div className="bottom-nav-item-icon">📊</div>
            <div>Home</div>
          </button>
          <button className={`bottom-nav-item ${activeTab === 'p2p' ? 'active' : ''}`} onClick={() => setActiveTab('p2p')}>
            <div className="bottom-nav-item-icon">💎</div>
            <div>Top-Up</div>
          </button>
          <button className={`bottom-nav-item ${activeTab === 'wallet' ? 'active' : ''}`} onClick={() => setActiveTab('wallet')}>
            <div className="bottom-nav-item-icon">💼</div>
            <div>Wallet</div>
          </button>
          <button className={`bottom-nav-item ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
            <div className="bottom-nav-item-icon">📜</div>
            <div>History</div>
          </button>
        </div>
    </>
  );
}
