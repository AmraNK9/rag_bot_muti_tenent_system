import { useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import {
  getResellers,
  getAnalytics,
  getRequests,
  approveRequest,
  getResellerTopUps,
  approveResellerTopUp,
  rejectResellerTopUp,
  getSystemSettings,
  getPlans,
  getAuditLogs,
} from './api/client';
import { Reseller, Analytics, PlanRequest, SystemSetting, Plan, ResellerTopUp, AuditLog } from './types';

import { LoginScreen } from './components/auth/LoginScreen';
import { Sidebar } from './components/layout/Sidebar';
import { ZoomModal } from './components/shared/ZoomModal';
import { AnalyticsTab } from './components/features/analytics/AnalyticsTab';
import { ResellersTab } from './components/features/resellers/ResellersTab';
import { RequestsTab } from './components/features/requests/RequestsTab';
import { TopupsTab } from './components/features/topups/TopupsTab';
import { PlansTab } from './components/features/plans/PlansTab';
import { SettingsTab } from './components/features/settings/SettingsTab';
import { LogsTab } from './components/features/logs/LogsTab';
import { SystemBotTab } from './components/features/system-bot/SystemBotTab';

type TabId = 'analytics' | 'resellers' | 'requests' | 'topups' | 'plans' | 'system-bot' | 'settings' | 'logs';

export default function App() {
  const [secret, setSecret] = useState<string | null>(localStorage.getItem('total_admin_secret'));
  const [activeTab, setActiveTab] = useState<TabId>('analytics');

  // Analytics states
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // Resellers states
  const [resellers, setResellers] = useState<Reseller[]>([]);
  const [loadingResellers, setLoadingResellers] = useState(false);

  // Requests states
  const [requests, setRequests] = useState<PlanRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  // Topups states
  const [topups, setTopups] = useState<ResellerTopUp[]>([]);
  const [loadingTopUps, setLoadingTopUps] = useState(false);

  // Settings states
  const [settings, setSettings] = useState<SystemSetting | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(false);

  // Plans states
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);

  // Logs states
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Zoom receipt modal
  const [zoomImgUrl, setZoomImgUrl] = useState<string | null>(null);

  const fetchTabDetails = useCallback(async () => {
    if (!secret) return;
    try {
      if (activeTab === 'analytics') {
        setLoadingAnalytics(true);
        const res = await getAnalytics();
        if (res.success) setAnalytics(res.stats);
      } else if (activeTab === 'resellers') {
        setLoadingResellers(true);
        const res = await getResellers();
        if (res.success) setResellers(res.resellers || []);
      } else if (activeTab === 'plans') {
        setLoadingPlans(true);
        const res = await getPlans();
        if (res.success) setPlans(res.plans || []);
      } else if (activeTab === 'logs') {
        setLoadingLogs(true);
        const res = await getAuditLogs();
        if (res.success) setLogs(res.logs || []);
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
        const settingsRes = await getSystemSettings();
        if (settingsRes.success && settingsRes.settings) {
          setSettings(settingsRes.settings);
        }
      }
    } catch (err: any) {
      if (err.response?.status === 403) {
        localStorage.removeItem('total_admin_secret');
        setSecret(null);
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
      setLoadingLogs(false);
    }
  }, [secret, activeTab]);

  useEffect(() => {
    if (secret) fetchTabDetails();
  }, [secret, activeTab, fetchTabDetails]);

  // Real-time socket connections for super admin upgrade requests queue
  useEffect(() => {
    if (!secret) return;

    const socket = io({
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      socket.emit('join_total_admin_room');
    });

    socket.on('new_upgrade_request', (newRequest: PlanRequest) => {
      setRequests((prev) => [newRequest, ...prev]);
      fetchTabDetails();
    });

    return () => {
      socket.disconnect();
    };
  }, [secret, fetchTabDetails]);

  const handleLogout = () => {
    localStorage.removeItem('total_admin_secret');
    setSecret(null);
    setAnalytics(null);
    setResellers([]);
    setRequests([]);
    setTopups([]);
    setPlans([]);
    setLogs([]);
  };

  const handleApprove = async (id: number, hasReseller: boolean) => {
    const confirmMsg = hasReseller 
      ? 'OVERRIDE PAYMENT: Approve client plan request directly from Super Admin panel?'
      : 'Approve client plan request?';
      
    if (!confirm(confirmMsg)) return;
    try {
      const res = await approveRequest(id);
      if (res.success) {
        alert(hasReseller ? 'Payment override approved and client upgraded successfully!' : 'Request approved and client upgraded successfully!');
        const reload = await getRequests();
        if (reload.success) setRequests(reload.requests || []);
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Approval failed.');
    }
  };

  const handleReject = async (id: number, hasReseller: boolean) => {
    const confirmMsg = hasReseller 
      ? 'OVERRIDE PAYMENT: Reject client plan request directly from Super Admin panel?'
      : 'Reject client plan request?';
      
    if (!confirm(confirmMsg)) return;
    try {
      const { rejectRequest } = await import('./api/client');
      const res = await rejectRequest(id);
      if (res.success) {
        alert(hasReseller ? 'Payment override rejected successfully!' : 'Request rejected successfully!');
        const reload = await getRequests();
        if (reload.success) setRequests(reload.requests || []);
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Rejection failed.');
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
      alert(err.response?.data?.error || 'Failed to approve top-up.');
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

  if (!secret) {
    return <LoginScreen setSecret={setSecret} />;
  }

  return (
    <div className="layout-wrapper">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} onLogout={handleLogout} />

      <main className="main-content">
        <header className="content-header">
          <div>
            <h1 className="content-title" style={{ textTransform: 'capitalize' }}>
              {activeTab === 'analytics' ? 'Overview' : activeTab === 'topups' ? 'Reseller Deposits' : activeTab}
            </h1>
            <p className="content-subtitle">
              {activeTab === 'analytics' && 'Platform summary statistics and daily usage logs.'}
              {activeTab === 'resellers' && 'Configure commissions, credit limits and status flags.'}
              {activeTab === 'requests' && 'Approve plan upgrades and process screenshot attachments.'}
              {activeTab === 'topups' && 'Manage reseller credit balance refills and collections.'}
              {activeTab === 'plans' && 'Define system service tiers and direct payment models.'}
              {activeTab === 'system-bot' && 'Configure AI Assistant guidelines, FAQs, and Telegram Bot token.'}
              {activeTab === 'settings' && 'Update system defaults for referrals and fee splits.'}
              {activeTab === 'logs' && 'Global actions audit history trails.'}
            </p>
          </div>
        </header>

        <div className="container">
          {activeTab === 'analytics' && (
            <AnalyticsTab analytics={analytics} loadingAnalytics={loadingAnalytics} />
          )}

          {activeTab === 'resellers' && (
            <ResellersTab
              resellers={resellers}
              loadingResellers={loadingResellers}
              setResellers={setResellers}
            />
          )}

          {activeTab === 'requests' && (
            <RequestsTab
              requests={requests}
              loadingRequests={loadingRequests}
              onApprove={handleApprove}
              onReject={handleReject}
              setZoomImgUrl={setZoomImgUrl}
            />
          )}

          {activeTab === 'topups' && (
            <TopupsTab
              topups={topups}
              loadingTopUps={loadingTopUps}
              onApproveTopUp={handleApproveTopUp}
              onRejectTopUp={handleRejectTopUp}
              setZoomImgUrl={setZoomImgUrl}
            />
          )}

          {activeTab === 'plans' && (
            <PlansTab plans={plans} loadingPlans={loadingPlans} setPlans={setPlans} />
          )}

          {activeTab === 'system-bot' && <SystemBotTab />}

          {activeTab === 'settings' && (
            <SettingsTab
              settings={settings}
              loadingSettings={loadingSettings}
              setSettings={setSettings}
            />
          )}

          {activeTab === 'logs' && <LogsTab logs={logs} loadingLogs={loadingLogs} />}
        </div>
      </main>

      {zoomImgUrl && <ZoomModal imageUrl={zoomImgUrl} onClose={() => setZoomImgUrl(null)} />}
    </div>
  );
}
