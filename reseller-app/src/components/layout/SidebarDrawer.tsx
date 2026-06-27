import React, { useState, useEffect } from 'react';
import { DashboardStats } from '../../types';
import { updateTelegramProfile, getSystemBotInfo } from '../../api/client';

interface SidebarDrawerProps {
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  stats: DashboardStats | null;
  onLogout: () => void;
}

export const SidebarDrawer: React.FC<SidebarDrawerProps> = ({
  drawerOpen,
  setDrawerOpen,
  stats,
  onLogout,
}) => {
  const [chatIdInput, setChatIdInput] = useState('');
  const [savingTelegram, setSavingTelegram] = useState(false);
  const [botUsername, setBotUsername] = useState('mock_bot');

  useEffect(() => {
    if (stats?.telegram_chat_id) {
      setChatIdInput(stats.telegram_chat_id);
    }
    getSystemBotInfo()
      .then((res) => {
        if (res.success && res.username) {
          setBotUsername(res.username);
        }
      })
      .catch(() => {});
  }, [stats]);

  if (!drawerOpen) return null;

  const handleSaveTelegram = async () => {
    if (!chatIdInput.trim()) return;
    setSavingTelegram(true);
    try {
      const res = await updateTelegramProfile(chatIdInput.trim());
      if (res.success) {
        alert('Telegram Chat ID updated successfully!');
      }
    } catch (e) {
      alert('Failed to update Telegram Chat ID');
    } finally {
      setSavingTelegram(false);
    }
  };

  return (
    <div className="drawer-overlay" onClick={() => setDrawerOpen(false)}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Menu</h2>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setDrawerOpen(false)}
            style={{ padding: '4px 8px' }}
          >
            ✕
          </button>
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
            <span className="drawer-item-val">
              {stats?.postpaid_limit ? Number(stats.postpaid_limit).toLocaleString() : '0'} MMK
            </span>
          </div>
        )}
        <div className="drawer-item">
          <span className="drawer-item-label">Trust Score</span>
          <span
            className="drawer-item-val"
            style={{
              color:
                (stats?.reliabilityScore || 0) >= 80 ? 'var(--success)' : 'var(--warning)',
            }}
          >
            {stats?.reliabilityScore || '100'}/100
          </span>
        </div>
        <div className="drawer-item">
          <span className="drawer-item-label">Referrals</span>
          <span className="drawer-item-val">{stats?.referredCount || '0'} clients</span>
        </div>

        {/* TELEGRAM NOTIFICATIONS CONNECT SECTION */}
        <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
          <div className="drawer-item-label" style={{ marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            🔔 Telegram Instant Alerts
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
            Receive real-time Telegram messages when clients request plan upgrades.
          </p>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <input
              className="form-control"
              placeholder="Enter Telegram Chat ID..."
              value={chatIdInput}
              onChange={(e) => setChatIdInput(e.target.value)}
              style={{ minHeight: '36px', padding: '8px', fontSize: '0.78rem' }}
            />
            <button
              className="btn btn-primary btn-sm"
              onClick={handleSaveTelegram}
              disabled={savingTelegram || !chatIdInput.trim()}
              style={{ minHeight: '36px', whiteSpace: 'nowrap' }}
            >
              {savingTelegram ? '...' : 'Save'}
            </button>
          </div>
          {stats?.id && (
            <a
              href={`https://t.me/${botUsername}?start=connect_${stats.id}`}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: '0.75rem', color: 'var(--primary)', textDecoration: 'none', display: 'inline-block' }}
            >
              👉 Or click here to Auto-Connect via Telegram Bot
            </a>
          )}
        </div>

        <div style={{ marginTop: '20px' }}>
          <div className="drawer-item-label" style={{ marginBottom: '8px' }}>
            Your Referral Link
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              className="form-control"
              readOnly
              value={`https://app.example.com/ref/${stats?.id || '0'}`}
              style={{ minHeight: '36px', padding: '8px', fontSize: '0.75rem' }}
            />
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                navigator.clipboard.writeText(`https://app.example.com/ref/${stats?.id || '0'}`);
                alert('Link copied!');
              }}
              style={{ minHeight: '36px' }}
            >
              Copy
            </button>
          </div>
        </div>

        <div style={{ marginTop: 'auto', paddingTop: '24px' }}>
          <button className="btn btn-danger" style={{ width: '100%' }} onClick={onLogout}>
            Logout
          </button>
        </div>
      </div>
    </div>
  );
};
