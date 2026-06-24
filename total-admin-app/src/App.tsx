import React, { useEffect, useState, useCallback } from 'react';
import {
  getResellers,
  updateReseller,
  getAnalytics,
  getRequests,
  approveRequest,
  getResellerTopUps,
  approveResellerTopUp,
  rejectResellerTopUp,
  getSystemSettings,
  updateSystemSettings,
  getPlans,
  updatePlan,
  createPlan,
} from './api/client';

interface Reseller {
  id: number;
  name: string;
  email: string;
  commission_percentage: number;
  balance: number;
  can_collect_payments: boolean;
  reliability_score: number;
  total_collected: number;
  kpay_no: string;
  kpay_name: string;
  custom_referrer_first_rate: number | null;
  custom_referrer_recurring_rate: number | null;
  custom_approver_rate: number | null;
  trust_score_factor: number;
  created_at: string;
}

interface Analytics {
  activeChatbots: number;
  totalQueries: number;
  cumulativeApiCost: number;
  activityLogs: Array<{
    id: number;
    chatbot_id: number;
    activity_date: string;
    query_count: number;
    api_cost: number;
    active_duration_seconds: number;
    chatbot?: { name: string };
  }>;
}

interface PlanRequest {
  id: number;
  business_id: number;
  reseller_id: number | null;
  plan_name: 'lite' | 'basic' | 'pro';
  screenshot_url: string;
  status: 'pending' | 'approved' | 'rejected';
  price: number;
  created_at: string;
  business?: { id: number; name: string };
  reseller?: { id: number; name: string };
}

interface SystemSetting {
  id: number;
  referrer_first_month_rate: number;
  referrer_recurring_rate: number;
  approver_fee_rate: number;
}

interface Plan {
  id: number;
  name: string;
  price: number;
  query_limit: number;
  duration_days: number;
  is_active: boolean;
  max_chat_history: number;
  services: string[];
}

// Resolve screenshot URL — use Vite proxy path (/uploads/…) when relative
const getImgSrc = (url: string) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return url.startsWith('/') ? url : `/${url}`;
};

// Safe onError: fallback to localhost:3000 direct, then give up
const handleImgError = (e: React.SyntheticEvent<HTMLImageElement>, url: string) => {
  const img = e.currentTarget;
  if (img.dataset.fallbackTried) return;
  img.dataset.fallbackTried = '1';
  const base = url.startsWith('/') ? `http://localhost:3000${url}` : `http://localhost:3000/${url}`;
  img.src = base;
};

export default function App() {
  const [secret, setSecret] = useState<string | null>(localStorage.getItem('total_admin_secret'));
  const [tempSecret, setTempSecret] = useState('');
  const [authError, setAuthError] = useState('');

  const [activeTab, setActiveTab] = useState<'analytics' | 'resellers' | 'requests' | 'topups' | 'settings'>('analytics');

  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  const [resellers, setResellers] = useState<Reseller[]>([]);
  const [loadingResellers, setLoadingResellers] = useState(false);
  const [editingReseller, setEditingReseller] = useState<Reseller | null>(null);

  const [reliabilityScore, setReliabilityScore] = useState(100);
  const [canCollectPayments, setCanCollectPayments] = useState(true);
  const [commissionRate, setCommissionRate] = useState(10);
  const [customReferrerFirstRate, setCustomReferrerFirstRate] = useState<string>('');
  const [customReferrerRecurringRate, setCustomReferrerRecurringRate] = useState<string>('');
  const [customApproverRate, setCustomApproverRate] = useState<string>('');
  const [trustScoreFactor, setTrustScoreFactor] = useState<number>(1.00);
  const [updatingReseller, setUpdatingReseller] = useState(false);

  const [requests, setRequests] = useState<PlanRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [zoomImgUrl, setZoomImgUrl] = useState<string | null>(null);

  const [settings, setSettings] = useState<SystemSetting | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [updatingSettings, setUpdatingSettings] = useState(false);
  const [referrerFirstMonthRate, setReferrerFirstMonthRate] = useState(30.00);
  const [referrerRecurringRate, setReferrerRecurringRate] = useState(10.00);
  const [approverFeeRate, setApproverFeeRate] = useState(10.00);

  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [creatingPlan, setCreatingPlan] = useState(false);
  const [planName, setPlanName] = useState('');
  const [planPrice, setPlanPrice] = useState(0);
  const [planQueryLimit, setPlanQueryLimit] = useState(0);
  const [planDurationDays, setPlanDurationDays] = useState(30);
  const [planIsActive, setPlanIsActive] = useState(true);
  const [planMaxChatHistory, setPlanMaxChatHistory] = useState(10);
  const [planServicesStr, setPlanServicesStr] = useState('');
  const [updatingPlan, setUpdatingPlan] = useState(false);

  const [topups, setTopups] = useState<any[]>([]);
  const [loadingTopUps, setLoadingTopUps] = useState(false);

  const fetchTabDetails = useCallback(async () => {
    if (!secret) return;
    try {
      if (activeTab === 'analytics') {
        setLoadingAnalytics(true);
        const res = await getAnalytics();
        if (res.success) {
          setAnalytics({
            activeChatbots: res.activeChatbots || 0,
            totalQueries: res.totalQueries || 0,
            cumulativeApiCost: Number(res.cumulativeApiCost) || 0,
            activityLogs: res.activityLogs || [],
          });
        }
      } else if (activeTab === 'resellers') {
        setLoadingResellers(true);
        const res = await getResellers();
        if (res.success) setResellers(res.resellers || []);
      } else if (activeTab === 'requests') {
        setLoadingRequests(true);
        const res = await getRequests();
        if (res.success) setRequests(res.requests || []);
      } else if (activeTab === 'topups') {
        setLoadingTopUps(true);
        const res = await getResellerTopUps();
        if (res.success) setTopups(res.topups || []);
      } else if (activeTab === 'settings') {
        setLoadingSettings(true);
        setLoadingPlans(true);
        const settingsRes = await getSystemSettings();
        if (settingsRes.success && settingsRes.settings) {
          setSettings(settingsRes.settings);
          setReferrerFirstMonthRate(Number(settingsRes.settings.referrer_first_month_rate));
          setReferrerRecurringRate(Number(settingsRes.settings.referrer_recurring_rate));
          setApproverFeeRate(Number(settingsRes.settings.approver_fee_rate));
        }
        const plansRes = await getPlans();
        if (plansRes.success) setPlans(plansRes.plans || []);
      }
    } catch (err: any) {
      if (err.response?.status === 403) {
        localStorage.removeItem('total_admin_secret');
        setSecret(null);
        setAuthError('Session expired: invalid secret key.');
      } else {
        console.error(err);
      }
    } finally {
      setLoadingAnalytics(false);
      setLoadingResellers(false);
      setLoadingRequests(false);
      setLoadingTopUps(false);
      setLoadingSettings(false);
      setLoadingPlans(false);
    }
  }, [secret, activeTab]);

  useEffect(() => {
    if (secret) fetchTabDetails();
  }, [secret, activeTab, fetchTabDetails]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempSecret.trim()) return;
    localStorage.setItem('total_admin_secret', tempSecret.trim());
    setSecret(tempSecret.trim());
    setAuthError('');
  };

  const handleLogout = () => {
    localStorage.removeItem('total_admin_secret');
    setSecret(null);
    setAnalytics(null);
    setResellers([]);
    setRequests([]);
  };

  const handleOpenEditReseller = (reseller: Reseller) => {
    setEditingReseller(reseller);
    setReliabilityScore(reseller.reliability_score);
    setCanCollectPayments(reseller.can_collect_payments);
    setCommissionRate(reseller.commission_percentage);
    setCustomReferrerFirstRate(reseller.custom_referrer_first_rate === null ? '' : String(reseller.custom_referrer_first_rate));
    setCustomReferrerRecurringRate(reseller.custom_referrer_recurring_rate === null ? '' : String(reseller.custom_referrer_recurring_rate));
    setCustomApproverRate(reseller.custom_approver_rate === null ? '' : String(reseller.custom_approver_rate));
    setTrustScoreFactor(reseller.trust_score_factor === null ? 1.00 : Number(reseller.trust_score_factor));
  };

  const handleUpdateResellerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReseller) return;
    setUpdatingReseller(true);
    try {
      const res = await updateReseller(editingReseller.id, {
        reliability_score: reliabilityScore,
        can_collect_payments: canCollectPayments,
        commission_percentage: commissionRate,
        custom_referrer_first_rate: customReferrerFirstRate === '' ? null : Number(customReferrerFirstRate),
        custom_referrer_recurring_rate: customReferrerRecurringRate === '' ? null : Number(customReferrerRecurringRate),
        custom_approver_rate: customApproverRate === '' ? null : Number(customApproverRate),
        trust_score_factor: Number(trustScoreFactor),
      });
      if (res.success) {
        alert('Reseller configurations updated successfully!');
        setEditingReseller(null);
        const reload = await getResellers();
        if (reload.success) setResellers(reload.resellers || []);
      }
    } catch (e) {
      alert('Failed to update reseller settings.');
    } finally {
      setUpdatingReseller(false);
    }
  };

  const handleOverrideApprove = async (id: number) => {
    if (!confirm('OVERRIDE PAYMENT: Approve client plan request directly from Super Admin panel?')) return;
    try {
      const res = await approveRequest(id);
      if (res.success) {
        alert('Payment override approved and client upgraded successfully!');
        fetchTabDetails();
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Override approval failed.');
    }
  };

  const handleApproveTopUp = async (id: number) => {
    if (!confirm('Approve this reseller top-up request and credit their wallet balance?')) return;
    try {
      const res = await approveResellerTopUp(id);
      if (res.success) {
        alert('Reseller top-up approved and wallet credited successfully!');
        const reload = await getResellerTopUps();
        if (reload.success) setTopups(reload.topups || []);
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to approve top-up request.');
    }
  };

  const handleRejectTopUp = async (id: number) => {
    if (!confirm('Reject this reseller top-up request?')) return;
    try {
      const res = await rejectResellerTopUp(id);
      if (res.success) {
        alert('Reseller top-up request rejected.');
        const reload = await getResellerTopUps();
        if (reload.success) setTopups(reload.topups || []);
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to reject top-up request.');
    }
  };

  const handleUpdateSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdatingSettings(true);
    try {
      const res = await updateSystemSettings({
        referrer_first_month_rate: Number(referrerFirstMonthRate),
        referrer_recurring_rate: Number(referrerRecurringRate),
        approver_fee_rate: Number(approverFeeRate),
      });
      if (res.success) {
        alert('Global commission settings updated successfully!');
        setSettings(res.settings);
      }
    } catch (err) {
      alert('Failed to update global commission settings.');
    } finally {
      setUpdatingSettings(false);
    }
  };

  const handleOpenCreatePlan = () => {
    setEditingPlan(null);
    setCreatingPlan(true);
    setPlanName('');
    setPlanPrice(0);
    setPlanQueryLimit(0);
    setPlanDurationDays(30);
    setPlanIsActive(true);
    setPlanMaxChatHistory(10);
    setPlanServicesStr('');
  };

  const handleOpenEditPlan = (plan: Plan) => {
    setCreatingPlan(false);
    setEditingPlan(plan);
    setPlanName(plan.name);
    setPlanPrice(plan.price);
    setPlanQueryLimit(plan.query_limit);
    setPlanDurationDays(plan.duration_days);
    setPlanIsActive(plan.is_active);
    setPlanMaxChatHistory(plan.max_chat_history || 10);
    setPlanServicesStr((plan.services || []).join(', '));
  };

  const handleSavePlanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdatingPlan(true);
    try {
      const services = planServicesStr.split(',').map(s => s.trim()).filter(s => s.length > 0);
      const data = {
        name: planName,
        price: Number(planPrice),
        query_limit: Number(planQueryLimit),
        duration_days: Number(planDurationDays),
        is_active: planIsActive,
        max_chat_history: Number(planMaxChatHistory),
        services,
      };

      if (creatingPlan) {
        const res = await createPlan(data);
        if (res.success) alert('Plan created successfully!');
      } else if (editingPlan) {
        const res = await updatePlan(editingPlan.id, data);
        if (res.success) alert('Plan configuration updated successfully!');
      }
      
      setEditingPlan(null);
      setCreatingPlan(false);
      const reload = await getPlans();
      if (reload.success) setPlans(reload.plans || []);
    } catch (err) {
      alert('Failed to save plan.');
    } finally {
      setUpdatingPlan(false);
    }
  };

  // ─── AUTHENTICATION VIEW ─────────────────────────────────────────────────
  if (!secret) {
    return (
      <div className="auth-wrapper">
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            width: '72px', height: '72px', borderRadius: '22px',
            background: 'linear-gradient(135deg, rgba(139,92,246,0.25) 0%, rgba(109,40,217,0.15) 100%)',
            border: '1px solid rgba(139,92,246,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '2rem', margin: '0 auto 16px'
          }}>🛡️</div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, letterSpacing: '-0.3px', marginBottom: '6px' }}>
            Super Admin Console
          </h1>
          <p style={{ fontSize: '0.82rem' }}>Platform control & usage monitoring</p>
        </div>

        <div className="card" style={{ maxWidth: '380px', width: '100%', margin: '0 auto' }}>
          {authError && (
            <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', fontSize: '0.8rem', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              ⚠️ {authError}
            </div>
          )}
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label>Admin Secret Key</label>
              <input
                className="form-control"
                type="password"
                required
                placeholder="Enter system secret key..."
                value={tempSecret}
                onChange={(e) => setTempSecret(e.target.value)}
              />
            </div>
            <button className="btn btn-primary" style={{ width: '100%', marginTop: '8px' }} type="submit">
              Access Control Console
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ─── MAIN ADMIN PANEL ────────────────────────────────────────────────────
  return (
    <div className="container">
      {/* HEADER */}
      <div className="header-bar">
        <div>
          <h1>🛡️ Super Admin</h1>
          <p style={{ marginTop: '2px' }}>Global analytics, resellers & payments</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
          Exit
        </button>
      </div>

      {/* TABS */}
      <div className="tabs-header">
        {([
          { key: 'analytics', label: '📊 Analytics' },
          { key: 'resellers', label: '🤝 Resellers' },
          { key: 'requests', label: '🗂️ Requests' },
          { key: 'topups', label: '💼 Top-ups' },
          { key: 'settings', label: '⚙️ Settings' },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            className={`tab-btn ${activeTab === key ? 'active' : ''}`}
            onClick={() => setActiveTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* TAB 1: ANALYTICS */}
      {activeTab === 'analytics' && (
        <>
          {loadingAnalytics ? (
            <div className="loading-state"><div className="spinner" /> Loading analytics...</div>
          ) : (
            <>
              <div className="metrics-grid">
                <div className="metric-card">
                  <h3>Active Chatbots</h3>
                  <div className="metric-card-val">{analytics?.activeChatbots || '0'}</div>
                  <p style={{ fontSize: '0.7rem', marginTop: '4px' }}>Total registered</p>
                </div>
                <div className="metric-card">
                  <h3>Total Queries</h3>
                  <div className="metric-card-val">{analytics?.totalQueries || '0'}</div>
                  <p style={{ fontSize: '0.7rem', marginTop: '4px' }}>Messages processed</p>
                </div>
                <div className="metric-card">
                  <h3>LLM Costs</h3>
                  <div className="metric-card-val" style={{ color: 'var(--danger)', fontSize: '1.3rem' }}>
                    ${analytics?.cumulativeApiCost ? Number(analytics.cumulativeApiCost).toFixed(4) : '0.00'}
                  </div>
                  <p style={{ fontSize: '0.7rem', marginTop: '4px' }}>Cumulative API spend</p>
                </div>
              </div>

              <div className="card">
                <h2>📈 Daily Activity Logs</h2>
                {analytics?.activityLogs.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-state-icon">📭</div>
                    <p>No activity records yet.</p>
                  </div>
                ) : (
                  <div className="table-scroll">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Chatbot</th>
                          <th>Queries</th>
                          <th>API Cost</th>
                          <th>Duration</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analytics?.activityLogs.map((log) => (
                          <tr key={log.id}>
                            <td>{log.activity_date}</td>
                            <td>#{log.chatbot_id} {log.chatbot?.name ? `(${log.chatbot.name})` : ''}</td>
                            <td><strong>{log.query_count}</strong></td>
                            <td style={{ color: 'var(--danger)' }}>${Number(log.api_cost).toFixed(5)}</td>
                            <td>{Math.round(log.active_duration_seconds / 60)} min</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* TAB 2: RESELLERS */}
      {activeTab === 'resellers' && (
        <>
          {loadingResellers ? (
            <div className="loading-state"><div className="spinner" /> Loading resellers...</div>
          ) : resellers.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-state-icon">🤝</div>
                <p>No reseller accounts registered.</p>
              </div>
            </div>
          ) : (
            <div className="resellers-list">
              {resellers.map((reseller) => (
                <div key={reseller.id} className="reseller-item-card">
                  <div className="reseller-item-header">
                    <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{reseller.name}</span>
                    <span className="badge badge-purple">ID: {reseller.id}</span>
                  </div>

                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    <div>{reseller.email}</div>
                    <div style={{ marginTop: '2px' }}>KPay: {reseller.kpay_no} · {reseller.kpay_name}</div>
                  </div>

                  <div className="reseller-meta-row">
                    <span>Commission <strong style={{ color: 'var(--text-main)' }}>{reseller.commission_percentage}%</strong></span>
                    <span>Collected <strong style={{ color: 'var(--success)' }}>{reseller.total_collected.toLocaleString()} MMK</strong></span>
                  </div>

                  <div className="reseller-meta-row">
                    <span>Balance <strong style={{ color: 'var(--text-main)' }}>{reseller.balance.toLocaleString()} MMK</strong></span>
                    <span>Trust <strong>{reseller.reliability_score}/100</strong></span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {reseller.can_collect_payments ? (
                      <span className="badge badge-green">Collector ✓</span>
                    ) : (
                      <span className="badge badge-red">Collector Off</span>
                    )}
                    <button className="btn btn-ghost btn-sm" onClick={() => handleOpenEditReseller(reseller)}>
                      ✏️ Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* TAB 3: REQUESTS */}
      {activeTab === 'requests' && (
        <>
          {loadingRequests ? (
            <div className="loading-state"><div className="spinner" /> Loading requests...</div>
          ) : requests.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-state-icon">🗂️</div>
                <p>No active subscription requests.</p>
              </div>
            </div>
          ) : (
            <div className="requests-grid">
              {requests.map((req) => (
                <div key={req.id} className="request-card">
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{req.business?.name || `Business #${req.business_id}`}</span>
                      <span className={`badge ${req.status === 'approved' ? 'badge-green' : req.status === 'rejected' ? 'badge-red' : 'badge-yellow'}`}>
                        {req.status.toUpperCase()}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      <div>Plan: <strong style={{ color: 'var(--text-main)' }}>{req.plan_name.toUpperCase()}</strong> · {req.price.toLocaleString()} MMK</div>
                      <div>Via: <strong>{req.reseller?.name || 'Central Office'}</strong></div>
                      <div>{new Date(req.created_at).toLocaleDateString()}</div>
                    </div>
                  </div>

                  <img
                    className="request-screenshot"
                    src={getImgSrc(req.screenshot_url)}
                    alt="Receipt"
                    onClick={() => setZoomImgUrl(req.screenshot_url)}
                    onError={(e) => handleImgError(e, req.screenshot_url)}
                  />

                  {req.status === 'pending' && (
                    <button className="btn btn-primary btn-sm" style={{ width: '100%' }} onClick={() => handleOverrideApprove(req.id)}>
                      ⚡ Override Approve
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* TAB 4: TOP-UPS */}
      {activeTab === 'topups' && (
        <>
          {loadingTopUps ? (
            <div className="loading-state"><div className="spinner" /> Loading top-ups...</div>
          ) : topups.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-state-icon">💼</div>
                <p>No reseller top-up requests found.</p>
              </div>
            </div>
          ) : (
            <div className="requests-grid">
              {topups.map((t) => (
                <div key={t.id} className="request-card">
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{t.reseller?.name || `Reseller #${t.reseller_id}`}</span>
                      <span className={`badge ${t.status === 'approved' ? 'badge-green' : t.status === 'rejected' ? 'badge-red' : 'badge-yellow'}`}>
                        {t.status.toUpperCase()}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      <div>Paid: <strong style={{ color: 'var(--text-main)' }}>{Number(t.amount_paid).toLocaleString()} MMK</strong></div>
                      <div>Credit: <strong style={{ color: 'var(--success)' }}>+{Number(t.credit_amount).toLocaleString()} MMK</strong></div>
                      <div>Commission: {t.reseller?.commission_percentage || '30'}% · {t.reseller?.can_collect_payments ? 'Postpaid' : 'Prepaid'}</div>
                      <div>{new Date(t.created_at).toLocaleString()}</div>
                    </div>
                  </div>

                  <img
                    className="request-screenshot"
                    src={getImgSrc(t.screenshot_url)}
                    alt="Receipt"
                    onClick={() => setZoomImgUrl(t.screenshot_url)}
                    onError={(e) => handleImgError(e, t.screenshot_url)}
                  />

                  {t.status === 'pending' && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => handleRejectTopUp(t.id)}>Reject</button>
                      <button className="btn btn-success btn-sm" style={{ flex: 1 }} onClick={() => handleApproveTopUp(t.id)}>Approve</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* TAB 5: SETTINGS & PLANS */}
      {activeTab === 'settings' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Global Commission Settings */}
          <div className="card">
            <h2>⚙️ Commission Settings</h2>
            {settings && (
              <p style={{ color: 'var(--success)', fontSize: '0.78rem', marginBottom: '12px' }}>
                ✓ System defaults synced (Config ID: {settings.id})
              </p>
            )}
            <p style={{ marginBottom: '16px' }}>Default commission rates across the platform when no reseller overrides are active.</p>
            {loadingSettings ? (
              <div className="loading-state"><div className="spinner" /> Loading...</div>
            ) : (
              <form onSubmit={handleUpdateSettingsSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '16px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Referrer First Month (%)</label>
                    <input className="form-control" type="number" min="0" max="100" step="0.01" required
                      value={referrerFirstMonthRate} onChange={(e) => setReferrerFirstMonthRate(Number(e.target.value))} />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Referrer Renewal (%)</label>
                    <input className="form-control" type="number" min="0" max="100" step="0.01" required
                      value={referrerRecurringRate} onChange={(e) => setReferrerRecurringRate(Number(e.target.value))} />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Approver Fee (%)</label>
                    <input className="form-control" type="number" min="0" max="100" step="0.01" required
                      value={approverFeeRate} onChange={(e) => setApproverFeeRate(Number(e.target.value))} />
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="btn btn-primary" style={{ width: 'auto' }} type="submit" disabled={updatingSettings}>
                    {updatingSettings ? 'Saving...' : 'Save Settings'}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Pricing Plans */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h2 style={{ margin: 0 }}>Subscription Plans</h2>
                <p style={{ margin: 0 }}>Configure subscription plan tiers and limits.</p>
              </div>
              <button className="btn btn-primary btn-sm" onClick={handleOpenCreatePlan}>
                + Create New Plan
              </button>
            </div>
            {loadingPlans ? (
              <div className="loading-state"><div className="spinner" /> Loading plans...</div>
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Plan</th>
                      <th>Price (MMK)</th>
                      <th>Queries</th>
                      <th>Duration</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plans.map((plan) => (
                      <tr key={plan.id}>
                        <td><strong style={{ textTransform: 'uppercase' }}>{plan.name}</strong></td>
                        <td>{plan.price.toLocaleString()}</td>
                        <td>{plan.query_limit.toLocaleString()}</td>
                        <td>{plan.duration_days}d</td>
                        <td>
                          {plan.is_active
                            ? <span className="badge badge-green">Active</span>
                            : <span className="badge badge-red">Inactive</span>}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => handleOpenEditPlan(plan)}>
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* EDIT PLAN MODAL */}
      {/* CREATE/EDIT PLAN MODAL */}
      {(editingPlan || creatingPlan) && (
        <div className="modal-overlay" onClick={() => { setEditingPlan(null); setCreatingPlan(false); }}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => { setEditingPlan(null); setCreatingPlan(false); }}>×</button>
            <h3 style={{ marginBottom: '4px' }}>
              {creatingPlan ? 'Create New Plan' : <>Edit Plan: <span style={{ textTransform: 'uppercase', color: 'var(--primary)' }}>{editingPlan?.name}</span></>}
            </h3>
            <p style={{ marginBottom: '20px', fontSize: '0.8rem' }}>Modify plan properties and AI limits.</p>
            <form onSubmit={handleSavePlanSubmit}>
              <div className="form-group">
                <label>Plan Name</label>
                <input className="form-control" type="text" required value={planName} onChange={(e) => setPlanName(e.target.value)} placeholder="e.g. starter" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="form-group">
                  <label>Price (MMK)</label>
                  <input className="form-control" type="number" min="0" required value={planPrice} onChange={(e) => setPlanPrice(Number(e.target.value))} />
                </div>
                <div className="form-group">
                  <label>Query Limit</label>
                  <input className="form-control" type="number" min="0" required value={planQueryLimit} onChange={(e) => setPlanQueryLimit(Number(e.target.value))} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="form-group">
                  <label>Duration (Days)</label>
                  <input className="form-control" type="number" min="1" required value={planDurationDays} onChange={(e) => setPlanDurationDays(Number(e.target.value))} />
                </div>
                <div className="form-group">
                  <label>Max Chat History</label>
                  <input className="form-control" type="number" min="1" max="100" required value={planMaxChatHistory} onChange={(e) => setPlanMaxChatHistory(Number(e.target.value))} />
                </div>
              </div>
              <div className="form-group">
                <label>Services (Comma-separated)</label>
                <textarea className="form-control" rows={3} value={planServicesStr} onChange={(e) => setPlanServicesStr(e.target.value)} placeholder="Live Chat, Priority Support, Analytics..."></textarea>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', margin: '16px 0' }}>
                <input type="checkbox" id="plan-active" checked={planIsActive} onChange={(e) => setPlanIsActive(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', cursor: 'pointer' }} />
                <label htmlFor="plan-active" style={{ cursor: 'pointer', fontSize: '0.875rem' }}>Enable Plan (Available for purchase)</label>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
                <button className="btn btn-ghost" style={{ flex: 1 }} type="button" onClick={() => { setEditingPlan(null); setCreatingPlan(false); }}>Cancel</button>
                <button className="btn btn-primary" style={{ flex: 1 }} type="submit" disabled={updatingPlan}>
                  {updatingPlan ? 'Saving...' : 'Save Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT RESELLER MODAL */}
      {editingReseller && (
        <div className="modal-overlay" onClick={() => setEditingReseller(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setEditingReseller(null)}>×</button>
            <h3 style={{ marginBottom: '4px' }}>Edit Reseller</h3>
            <p style={{ marginBottom: '20px', fontSize: '0.8rem' }}>
              Updating: <strong>{editingReseller.name}</strong>
            </p>
            <form onSubmit={handleUpdateResellerSubmit}>
              <div className="form-group">
                <label>Trust Rating (0–100)</label>
                <input className="form-control" type="number" min="0" max="100" required value={reliabilityScore} onChange={(e) => setReliabilityScore(Number(e.target.value))} />
              </div>
              <div className="form-group">
                <label>Commission (%)</label>
                <input className="form-control" type="number" min="0" max="100" required value={commissionRate} onChange={(e) => setCommissionRate(Number(e.target.value))} />
              </div>
              <div className="form-group">
                <label>Custom Referrer First Rate (%) — optional</label>
                <input className="form-control" type="number" min="0" max="100" step="0.01" placeholder="Leave empty to use system default" value={customReferrerFirstRate} onChange={(e) => setCustomReferrerFirstRate(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Custom Referrer Renewal Rate (%) — optional</label>
                <input className="form-control" type="number" min="0" max="100" step="0.01" placeholder="Leave empty to use system default" value={customReferrerRecurringRate} onChange={(e) => setCustomReferrerRecurringRate(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Custom Approver Fee Rate (%) — optional</label>
                <input className="form-control" type="number" min="0" max="100" step="0.01" placeholder="Leave empty to use system default" value={customApproverRate} onChange={(e) => setCustomApproverRate(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Trust Score Factor (multiplier)</label>
                <input className="form-control" type="number" min="0.1" max="10.0" step="0.01" required value={trustScoreFactor} onChange={(e) => setTrustScoreFactor(Number(e.target.value))} />
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', margin: '16px 0' }}>
                <input type="checkbox" id="can-collect" checked={canCollectPayments} onChange={(e) => setCanCollectPayments(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', cursor: 'pointer' }} />
                <label htmlFor="can-collect" style={{ cursor: 'pointer', fontSize: '0.875rem' }}>Enable KPay Collector (Payment routing)</label>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
                <button className="btn btn-ghost" style={{ flex: 1 }} type="button" onClick={() => setEditingReseller(null)}>Cancel</button>
                <button className="btn btn-primary" style={{ flex: 1 }} type="submit" disabled={updatingReseller}>
                  {updatingReseller ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ZOOM RECEIPT */}
      {zoomImgUrl && (
        <div className="modal-overlay" onClick={() => setZoomImgUrl(null)}>
          <div className="modal-box" style={{ maxWidth: '440px', padding: '16px' }} onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setZoomImgUrl(null)}>×</button>
            <h3 style={{ marginBottom: '14px' }}>KPay Receipt</h3>
            <img
              src={getImgSrc(zoomImgUrl)}
              alt="Receipt"
              style={{ width: '100%', height: 'auto', maxHeight: '80vh', objectFit: 'contain', borderRadius: '8px', display: 'block' }}
              onError={(e) => handleImgError(e, zoomImgUrl)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
