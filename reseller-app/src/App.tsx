import { useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import {
  getDashboard,
  getRequests,
  approveRequest,
  rejectRequest,
  getTopUpHistory,
  getRequestsHistory,
  getPlans,
  getP2PHistory,
} from './api/client';

// Shared types
import { DashboardStats, PlanRequest, TopUpHistoryItem, P2PTopupTransaction, Plan } from './types';

// Components
import { AuthScreen } from './components/auth/AuthScreen';
import { AppBar } from './components/layout/AppBar';
import { SidebarDrawer } from './components/layout/SidebarDrawer';
import { BottomNav } from './components/layout/BottomNav';
import { ZoomModal } from './components/shared/ZoomModal';

// Features
import { DashboardTab } from './components/features/dashboard/DashboardTab';
import { P2PTab } from './components/features/p2p/P2PTab';
import { WalletTab } from './components/features/wallet/WalletTab';
import { HistoryTab } from './components/features/history/HistoryTab';

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('reseller_token'));
  const [activeTab, setActiveTab] = useState<'dashboard' | 'p2p' | 'wallet' | 'history'>('dashboard');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [zoomImgUrl, setZoomImgUrl] = useState<string | null>(null);

  // Dash & request lists
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [requests, setRequests] = useState<PlanRequest[]>([]);
  const [requestHistory, setRequestHistory] = useState<PlanRequest[]>([]);
  const [topups, setTopups] = useState<TopUpHistoryItem[]>([]);
  const [p2pPackages, setP2pPackages] = useState<Plan[]>([]);
  const [p2pHistory, setP2pHistory] = useState<P2PTopupTransaction[]>([]);
  
  const [loadingDashboard, setLoadingDashboard] = useState(false);

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
      console.error('Error fetching dashboard data:', e);
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

  // Real-time socket connections for reseller requests queue
  useEffect(() => {
    if (!token || !stats?.id) return;

    const socket = io({
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      console.log('[Socket] Connected as reseller, joining room:', stats.id);
      socket.emit('join_reseller_room', stats.id);
    });

    socket.on('new_upgrade_request', (newRequest: PlanRequest) => {
      console.log('[Socket] Received new upgrade request in real-time:', newRequest);
      // Append new request to list
      setRequests((prev) => [newRequest, ...prev]);
      // Update stats and balances in background
      fetchDashboard();
    });

    socket.on('telegram_connected', (data: { telegram_chat_id: string; telegram_username: string }) => {
      console.log('[Socket] Telegram connected in real-time:', data);
      setStats((prev) => (prev ? { ...prev, telegram_chat_id: data.telegram_chat_id, telegram_username: data.telegram_username } : prev));
    });

    return () => {
      socket.disconnect();
    };
  }, [token, stats?.id, fetchDashboard]);

  const handleLogout = () => {
    localStorage.removeItem('reseller_token');
    setToken(null);
    setStats(null);
    setRequests([]);
    setRequestHistory([]);
    setTopups([]);
    setP2pHistory([]);
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

  // ─── AUTHENTICATION VIEW ───────────────────────────────────────────────────
  if (!token) {
    return <AuthScreen setToken={setToken} />;
  }

  // ─── MAIN PORTAL VIEW ──────────────────────────────────────────────────────
  return (
    <>
      <AppBar activeTab={activeTab} onMenuClick={() => setDrawerOpen(true)} />

      <SidebarDrawer
        drawerOpen={drawerOpen}
        setDrawerOpen={setDrawerOpen}
        stats={stats}
        onLogout={handleLogout}
      />

      <div className="container">
        {activeTab === 'dashboard' && (
          <DashboardTab
            stats={stats}
            requests={requests}
            loadingDashboard={loadingDashboard}
            onApprove={handleApprove}
            onReject={handleReject}
            setZoomImgUrl={setZoomImgUrl}
          />
        )}

        {activeTab === 'p2p' && (
          <P2PTab p2pPackages={p2pPackages} fetchDashboard={fetchDashboard} />
        )}

        {activeTab === 'wallet' && (
          <WalletTab
            stats={stats}
            topups={topups}
            fetchDashboard={fetchDashboard}
            setZoomImgUrl={setZoomImgUrl}
          />
        )}

        {activeTab === 'history' && (
          <HistoryTab requestHistory={requestHistory} p2pHistory={p2pHistory} />
        )}
      </div>

      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />

      {zoomImgUrl && <ZoomModal imageUrl={zoomImgUrl} onClose={() => setZoomImgUrl(null)} />}
    </>
  );
}
