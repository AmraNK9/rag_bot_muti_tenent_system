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
    chatbot?: {
      name: string;
    };
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
  business?: {
    id: number;
    name: string;
  };
  reseller?: {
    id: number;
    name: string;
  };
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
}

export default function App() {
  const [secret, setSecret] = useState<string | null>(localStorage.getItem('total_admin_secret'));
  const [tempSecret, setTempSecret] = useState('');
  const [authError, setAuthError] = useState('');

  // Dashboard Tabs: 'analytics' | 'resellers' | 'requests' | 'topups' | 'settings'
  const [activeTab, setActiveTab] = useState<'analytics' | 'resellers' | 'requests' | 'topups' | 'settings'>('analytics');

  // Analytics states
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // Resellers states
  const [resellers, setResellers] = useState<Reseller[]>([]);
  const [loadingResellers, setLoadingResellers] = useState(false);
  const [editingReseller, setEditingReseller] = useState<Reseller | null>(null);
  
  // Edit Reseller Form states
  const [reliabilityScore, setReliabilityScore] = useState(100);
  const [canCollectPayments, setCanCollectPayments] = useState(true);
  const [commissionRate, setCommissionRate] = useState(10);
  
  // Custom Overrides Form states
  const [customReferrerFirstRate, setCustomReferrerFirstRate] = useState<string>('');
  const [customReferrerRecurringRate, setCustomReferrerRecurringRate] = useState<string>('');
  const [customApproverRate, setCustomApproverRate] = useState<string>('');
  const [trustScoreFactor, setTrustScoreFactor] = useState<number>(1.00);
  const [updatingReseller, setUpdatingReseller] = useState(false);

  // Requests states
  const [requests, setRequests] = useState<PlanRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [zoomImgUrl, setZoomImgUrl] = useState<string | null>(null);

  // Global settings states
  const [settings, setSettings] = useState<SystemSetting | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [updatingSettings, setUpdatingSettings] = useState(false);
  
  // Settings Form values
  const [referrerFirstMonthRate, setReferrerFirstMonthRate] = useState(30.00);
  const [referrerRecurringRate, setReferrerRecurringRate] = useState(10.00);
  const [approverFeeRate, setApproverFeeRate] = useState(10.00);

  // Plans settings states
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  
  // Edit Plan Form values
  const [planPrice, setPlanPrice] = useState(0);
  const [planQueryLimit, setPlanQueryLimit] = useState(0);
  const [planDurationDays, setPlanDurationDays] = useState(30);
  const [planIsActive, setPlanIsActive] = useState(true);
  const [updatingPlan, setUpdatingPlan] = useState(false);

  // Reseller Top-ups states
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
        if (res.success) {
          setResellers(res.resellers || []);
        }
      } else if (activeTab === 'requests') {
        setLoadingRequests(true);
        const res = await getRequests();
        if (res.success) {
          setRequests(res.requests || []);
        }
      } else if (activeTab === 'topups') {
        setLoadingTopUps(true);
        const res = await getResellerTopUps();
        if (res.success) {
          setTopups(res.topups || []);
        }
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
        if (plansRes.success) {
          setPlans(plansRes.plans || []);
        }
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
    if (secret) {
      fetchTabDetails();
    }
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
        // reload resellers
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
        // reload topups
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
        // reload topups
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

  const handleOpenEditPlan = (plan: Plan) => {
    setEditingPlan(plan);
    setPlanPrice(plan.price);
    setPlanQueryLimit(plan.query_limit);
    setPlanDurationDays(plan.duration_days);
    setPlanIsActive(plan.is_active);
  };

  const handleUpdatePlanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan) return;
    setUpdatingPlan(true);
    try {
      const res = await updatePlan(editingPlan.id, {
        price: Number(planPrice),
        query_limit: Number(planQueryLimit),
        duration_days: Number(planDurationDays),
        is_active: planIsActive,
      });
      if (res.success) {
        alert('Plan configuration updated successfully!');
        setEditingPlan(null);
        // reload plans
        const reload = await getPlans();
        if (reload.success) setPlans(reload.plans || []);
      }
    } catch (err) {
      alert('Failed to update plan configurations.');
    } finally {
      setUpdatingPlan(false);
    }
  };

  // ─── AUTHENTICATION VIEW ─────────────────────────────────────────────────
  if (!secret) {
    return (
      <div className="auth-wrapper">
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ fontSize: '3rem' }}>🛡️</div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '8px 0 2px' }}>Super Admin Dashboard</h1>
          <p style={{ fontSize: '0.82rem' }}>Platform control console & usage monitoring</p>
        </div>

        <div className="card">
          {authError && (
            <div style={{ padding: '8px 12px', background: 'rgba(239, 68, 68, 0.15)', color: 'var(--danger)', borderRadius: '6px', fontSize: '0.8rem', marginBottom: '16px' }}>
              ⚠️ {authError}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label>Admin Secret Authorization Key</label>
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
          <h1>🛡️ Super Admin Control Center</h1>
          <p>Global Analytics, Resellers and Payments Override Queue</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={handleLogout}>Exit Console</button>
      </div>

      {/* TABS */}
      <div className="tabs-header">
        <button className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`} onClick={() => setActiveTab('analytics')}>
          📊 Usage Analytics
        </button>
        <button className={`tab-btn ${activeTab === 'resellers' ? 'active' : ''}`} onClick={() => setActiveTab('resellers')}>
          🤝 Reseller Networks
        </button>
        <button className={`tab-btn ${activeTab === 'requests' ? 'active' : ''}`} onClick={() => setActiveTab('requests')}>
          🗂️ Global Requests
        </button>
        <button className={`tab-btn ${activeTab === 'topups' ? 'active' : ''}`} onClick={() => setActiveTab('topups')}>
          💼 Reseller Top-ups
        </button>
        <button className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
          ⚙️ Settings & Plans
        </button>
      </div>

      {/* TAB 1: ANALYTICS */}
      {activeTab === 'analytics' && (
        <>
          {loadingAnalytics ? (
            <div style={{ textAlign: 'center', padding: '45px' }}><div className="spinner" /> Loading platform analytics...</div>
          ) : (
            <>
              <div className="metrics-grid">
                <div className="metric-card">
                  <h3>Active Chatbots</h3>
                  <div className="metric-card-val">{analytics?.activeChatbots || '0'}</div>
                  <p style={{ fontSize: '0.72rem', marginTop: '4px' }}>Total chatbots registered</p>
                </div>

                <div className="metric-card">
                  <h3>Total Queries Serviced</h3>
                  <div className="metric-card-val">{analytics?.totalQueries || '0'}</div>
                  <p style={{ fontSize: '0.72rem', marginTop: '4px' }}>Global messages processed</p>
                </div>

                <div className="metric-card">
                  <h3>Cumulative LLM Costs</h3>
                  <div className="metric-card-val" style={{ color: 'var(--danger)' }}>
                    ${analytics?.cumulativeApiCost ? Number(analytics.cumulativeApiCost).toFixed(5) : '0.00000'}
                  </div>
                  <p style={{ fontSize: '0.72rem', marginTop: '4px' }}>DeepSeek & Voyager API costs</p>
                </div>
              </div>

              <div className="card">
                <h2>📈 Daily Chatbot Activity Logs</h2>
                {analytics?.activityLogs.length === 0 ? (
                  <p style={{ textAlign: 'center', padding: '20px' }}>No activity records flushed to DB yet.</p>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-glass)', color: 'var(--text-muted)' }}>
                          <th style={{ padding: '10px' }}>Date</th>
                          <th style={{ padding: '10px' }}>Chatbot ID / Name</th>
                          <th style={{ padding: '10px' }}>Queries Count</th>
                          <th style={{ padding: '10px' }}>Estimated Cost</th>
                          <th style={{ padding: '10px' }}>Active Duration</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analytics?.activityLogs.map((log) => (
                          <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                            <td style={{ padding: '10px' }}>{log.activity_date}</td>
                            <td style={{ padding: '10px' }}>
                              #{log.chatbot_id} {log.chatbot?.name ? `(${log.chatbot.name})` : ''}
                            </td>
                            <td style={{ padding: '10px', fontWeight: 'bold' }}>{log.query_count}</td>
                            <td style={{ padding: '10px', color: 'var(--danger)' }}>
                              ${Number(log.api_cost).toFixed(5)}
                            </td>
                            <td style={{ padding: '10px' }}>{Math.round(log.active_duration_seconds / 60)} mins</td>
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
            <div style={{ textAlign: 'center', padding: '45px' }}><div className="spinner" /> Loading resellers database...</div>
          ) : resellers.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '30px' }}>No reseller accounts registered.</div>
          ) : (
            <div className="resellers-list">
              {resellers.map((reseller) => (
                <div key={reseller.id} className="reseller-item-card">
                  <div className="reseller-item-header">
                    <span style={{ fontWeight: 'bold', fontSize: '1rem' }}>{reseller.name}</span>
                    <span className="badge badge-purple">Code: {reseller.id}</span>
                  </div>

                  <p style={{ fontSize: '0.8rem' }}>Email: <strong style={{ color: 'var(--text-main)' }}>{reseller.email}</strong></p>
                  <p style={{ fontSize: '0.8rem' }}>KPay: <strong style={{ color: 'var(--text-main)' }}>{reseller.kpay_no} ({reseller.kpay_name})</strong></p>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginTop: '6px' }}>
                    <span>Rate: <strong>{reseller.commission_percentage}%</strong></span>
                    <span>Collected: <strong>{reseller.total_collected.toLocaleString()} MMK</strong></span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                    <span>Wallet Balance: <strong>{reseller.balance.toLocaleString()} MMK</strong></span>
                    <span>Trust Score: <strong>{reseller.reliability_score}/100</strong></span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                    <span>
                      {reseller.can_collect_payments ? (
                        <span className="badge badge-green">Collector Active ✅</span>
                      ) : (
                        <span className="badge badge-red">Collector Disabled ❌</span>
                      )}
                    </span>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleOpenEditReseller(reseller)}>
                      ✏️ Edit Config
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* TAB 3: Direct REQUESTS OVERRIDE QUEUE */}
      {activeTab === 'requests' && (
        <>
          {loadingRequests ? (
            <div style={{ textAlign: 'center', padding: '45px' }}><div className="spinner" /> Loading platforms upgrade queries...</div>
          ) : requests.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '30px' }}>No active subscription purchase requests.</div>
          ) : (
            <div className="requests-grid">
              {requests.map((req) => (
                <div key={req.id} className="request-card">
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                      <span style={{ fontWeight: 'bold' }}>{req.business?.name || `Business #${req.business_id}`}</span>
                      <span className={`badge ${req.status === 'approved' ? 'badge-green' : req.status === 'rejected' ? 'badge-red' : 'badge-yellow'}`}>
                        {req.status.toUpperCase()}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                      <div>Plan: <strong style={{ color: 'var(--text-main)' }}>{req.plan_name.toUpperCase()}</strong> ({req.price.toLocaleString()} MMK)</div>
                      <div>Routed To: <strong>{req.reseller?.name || 'Central Office'}</strong> (ID: {req.reseller_id || 'Fallback'})</div>
                      <div>Date: {new Date(req.created_at).toLocaleDateString()}</div>
                    </div>
                  </div>

                  <img
                    className="request-screenshot"
                    src={req.screenshot_url}
                    alt="Receipt preview"
                    onClick={() => setZoomImgUrl(req.screenshot_url)}
                    onError={(e) => {
                      e.currentTarget.src = `http://localhost:3000${req.screenshot_url}`;
                    }}
                    style={{ height: '140px', objectFit: 'cover', borderRadius: '8px', cursor: 'pointer', margin: '8px 0' }}
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

      {/* TAB 4: RESELLER TOP-UPS */}
      {activeTab === 'topups' && (
        <>
          {loadingTopUps ? (
            <div style={{ textAlign: 'center', padding: '45px' }}><div className="spinner" /> Loading reseller top-ups...</div>
          ) : topups.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '30px' }}>No reseller top-up requests found.</div>
          ) : (
            <div className="requests-grid">
              {topups.map((t) => (
                <div key={t.id} className="request-card">
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                      <span style={{ fontWeight: 'bold' }}>{t.reseller?.name || `Reseller #${t.reseller_id}`}</span>
                      <span className={`badge ${t.status === 'approved' ? 'badge-green' : t.status === 'rejected' ? 'badge-red' : 'badge-yellow'}`}>
                        {t.status.toUpperCase()}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                      <div>Cash Paid: <strong style={{ color: 'var(--text-main)' }}>{Number(t.amount_paid).toLocaleString()} MMK</strong></div>
                      <div>Credit Value: <strong style={{ color: 'var(--success)' }}>+{Number(t.credit_amount).toLocaleString()} MMK</strong></div>
                      <div>Commission Rate: <strong>{t.reseller?.commission_percentage || '30'}%</strong></div>
                      <div>Type: <strong>{t.reseller?.can_collect_payments ? 'Postpaid' : 'Prepaid'}</strong></div>
                      <div>Date: {new Date(t.created_at).toLocaleString()}</div>
                    </div>
                  </div>

                  <img
                    className="request-screenshot"
                    src={t.screenshot_url}
                    alt="Receipt preview"
                    onClick={() => setZoomImgUrl(t.screenshot_url)}
                    onError={(e) => {
                      e.currentTarget.src = `http://localhost:3000${t.screenshot_url}`;
                    }}
                    style={{ height: '140px', objectFit: 'cover', borderRadius: '8px', cursor: 'pointer', margin: '8px 0' }}
                  />

                  {t.status === 'pending' && (
                    <div className="request-actions" style={{ display: 'flex', gap: '8px' }}>
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

      {/* TAB 5: SYSTEM SETTINGS & PLANS */}
      {activeTab === 'settings' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Global Commission Settings Card */}
          <div className="card">
            <h2>⚙️ Global Commission Settings</h2>
            {settings && (
              <p style={{ fontSize: '0.8rem', color: 'var(--success)', marginBottom: '8px' }}>
                ✓ System defaults synced (ID: {settings.id})
              </p>
            )}
            <p style={{ marginBottom: '16px' }}>Set default commission rates used across the platform when no reseller overrides are active.</p>
            {loadingSettings ? (
              <div style={{ textAlign: 'center', padding: '20px' }}><div className="spinner" /> Loading settings...</div>
            ) : (
              <form onSubmit={handleUpdateSettingsSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                  <div className="form-group">
                    <label>Referrer First Month Rate (%)</label>
                    <input
                      className="form-control"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      required
                      value={referrerFirstMonthRate}
                      onChange={(e) => setReferrerFirstMonthRate(Number(e.target.value))}
                    />
                  </div>
                  <div className="form-group">
                    <label>Referrer Renewal Rate (%)</label>
                    <input
                      className="form-control"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      required
                      value={referrerRecurringRate}
                      onChange={(e) => setReferrerRecurringRate(Number(e.target.value))}
                    />
                  </div>
                  <div className="form-group">
                    <label>Approver Fee Rate (%)</label>
                    <input
                      className="form-control"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      required
                      value={approverFeeRate}
                      onChange={(e) => setApproverFeeRate(Number(e.target.value))}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="btn btn-primary" type="submit" disabled={updatingSettings}>
                    {updatingSettings ? 'Saving Settings...' : 'Save Commission Settings'}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Pricing Plans Card */}
          <div className="card">
            <h2>Subscription Plans Pricing</h2>
            <p style={{ marginBottom: '16px' }}>Configure standard subscription plan tiers and limits.</p>
            {loadingPlans ? (
              <div style={{ textAlign: 'center', padding: '20px' }}><div className="spinner" /> Loading plans...</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-glass)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '12px' }}>Plan Name</th>
                      <th style={{ padding: '12px' }}>Price (MMK)</th>
                      <th style={{ padding: '12px' }}>Query Limit</th>
                      <th style={{ padding: '12px' }}>Duration</th>
                      <th style={{ padding: '12px' }}>Status</th>
                      <th style={{ padding: '12px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plans.map((plan) => (
                      <tr key={plan.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>{plan.name}</td>
                        <td style={{ padding: '12px' }}>{plan.price.toLocaleString()} MMK</td>
                        <td style={{ padding: '12px' }}>{plan.query_limit.toLocaleString()} msgs</td>
                        <td style={{ padding: '12px' }}>{plan.duration_days} Days</td>
                        <td style={{ padding: '12px' }}>
                          {plan.is_active ? (
                            <span className="badge badge-green">Active</span>
                          ) : (
                            <span className="badge badge-red">Inactive</span>
                          )}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right' }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => handleOpenEditPlan(plan)}>
                            ✏️ Edit Plan
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
      {editingPlan && (
        <div className="modal-overlay" onClick={() => setEditingPlan(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setEditingPlan(null)}>&times;</button>
            <h3>🔧 Edit Subscription Plan: <span style={{ textTransform: 'uppercase' }}>{editingPlan.name}</span></h3>
            <p style={{ marginBottom: '16px', fontSize: '0.8rem' }}>Modify price, query limits, and status parameters.</p>
            
            <form onSubmit={handleUpdatePlanSubmit}>
              <div className="form-group">
                <label>Plan Price (MMK)</label>
                <input
                  className="form-control"
                  type="number"
                  min="0"
                  required
                  value={planPrice}
                  onChange={(e) => setPlanPrice(Number(e.target.value))}
                />
              </div>

              <div className="form-group">
                <label>Query Limit (Messages)</label>
                <input
                  className="form-control"
                  type="number"
                  min="0"
                  required
                  value={planQueryLimit}
                  onChange={(e) => setPlanQueryLimit(Number(e.target.value))}
                />
              </div>

              <div className="form-group">
                <label>Duration (Days)</label>
                <input
                  className="form-control"
                  type="number"
                  min="1"
                  required
                  value={planDurationDays}
                  onChange={(e) => setPlanDurationDays(Number(e.target.value))}
                />
              </div>

              <div className="form-group" style={{ display: 'flex', gap: '8px', alignItems: 'center', margin: '18px 0' }}>
                <input
                  type="checkbox"
                  id="plan-active"
                  checked={planIsActive}
                  onChange={(e) => setPlanIsActive(e.target.checked)}
                  style={{ width: '18px', height: '18px' }}
                />
                <label htmlFor="plan-active" style={{ margin: 0, cursor: 'pointer', textTransform: 'none' }}>
                  Enable Plan Tier (Available for purchase)
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
                <button className="btn btn-ghost" type="button" onClick={() => setEditingPlan(null)}>Cancel</button>
                <button className="btn btn-primary" type="submit" disabled={updatingPlan}>
                  {updatingPlan ? 'Updating...' : 'Save Plan'}
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
            <button className="modal-close" onClick={() => setEditingReseller(null)}>&times;</button>
            <h3>🔧 Edit Reseller Network Node</h3>
            <p style={{ marginBottom: '16px', fontSize: '0.8rem' }}>Update properties for reseller <strong>{editingReseller.name}</strong></p>
            
            <form onSubmit={handleUpdateResellerSubmit}>
              <div className="form-group">
                <label>Reliability Trust Rating (0 - 100)</label>
                <input
                  className="form-control"
                  type="number"
                  min="0"
                  max="100"
                  required
                  value={reliabilityScore}
                  onChange={(e) => setReliabilityScore(Number(e.target.value))}
                />
              </div>

              <div className="form-group">
                <label>Commission Percentage (%)</label>
                <input
                  className="form-control"
                  type="number"
                  min="0"
                  max="100"
                  required
                  value={commissionRate}
                  onChange={(e) => setCommissionRate(Number(e.target.value))}
                />
              </div>

              <div className="form-group">
                <label>Custom Referrer First Rate Override (%)</label>
                <input
                  className="form-control"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  placeholder="Leave empty to use system default"
                  value={customReferrerFirstRate}
                  onChange={(e) => setCustomReferrerFirstRate(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Custom Referrer Renewal Rate Override (%)</label>
                <input
                  className="form-control"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  placeholder="Leave empty to use system default"
                  value={customReferrerRecurringRate}
                  onChange={(e) => setCustomReferrerRecurringRate(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Custom Approver Fee Rate Override (%)</label>
                <input
                  className="form-control"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  placeholder="Leave empty to use system default"
                  value={customApproverRate}
                  onChange={(e) => setCustomApproverRate(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Trust Score Factor (Multiplier, e.g. 1.00)</label>
                <input
                  className="form-control"
                  type="number"
                  min="0.1"
                  max="10.0"
                  step="0.01"
                  required
                  value={trustScoreFactor}
                  onChange={(e) => setTrustScoreFactor(Number(e.target.value))}
                />
              </div>

              <div className="form-group" style={{ display: 'flex', gap: '8px', alignItems: 'center', margin: '18px 0' }}>
                <input
                  type="checkbox"
                  id="can-collect"
                  checked={canCollectPayments}
                  onChange={(e) => setCanCollectPayments(e.target.checked)}
                  style={{ width: '18px', height: '18px' }}
                />
                <label htmlFor="can-collect" style={{ margin: 0, cursor: 'pointer', textTransform: 'none' }}>
                  Enable KPay Collector (Payment routing eligibility)
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
                <button className="btn btn-ghost" type="button" onClick={() => setEditingReseller(null)}>Cancel</button>
                <button className="btn btn-primary" type="submit" disabled={updatingReseller}>
                  {updatingReseller ? 'Updating...' : 'Save Settings'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ZOOM RECEIPT PREVIEW */}
      {zoomImgUrl && (
        <div className="modal-overlay" onClick={() => setZoomImgUrl(null)}>
          <div className="modal-box" style={{ maxWidth: '420px', padding: '16px' }} onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setZoomImgUrl(null)}>&times;</button>
            <h3 style={{ marginBottom: '16px' }}>Zoomed KPay Screenshot Receipt</h3>
            <img
              src={zoomImgUrl}
              alt="Zoomed Receipt"
              style={{ width: '100%', height: 'auto', borderRadius: '8px' }}
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
