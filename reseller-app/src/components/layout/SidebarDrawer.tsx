import React, { useState, useEffect } from 'react';
import { DashboardStats } from '../../types';
import { getSystemBotInfo } from '../../api/client';

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
  const [botUsername, setBotUsername] = useState('mock_bot');

  useEffect(() => {
    getSystemBotInfo()
      .then((res) => {
        if (res.success && res.username) {
          setBotUsername(res.username);
        }
      })
      .catch(() => {});
  }, []);

  if (!drawerOpen) return null;

  const isConnected = !!stats?.telegram_chat_id;

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

        {/* TELEGRAM REAL-TIME NOTIFICATIONS CONNECT SECTION */}
        <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
          <div className="drawer-item-label" style={{ marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            🔔 Telegram Instant Alerts
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
            Receive instant Telegram messages when clients request plan upgrades.
          </p>

          <div style={{
            padding: '12px',
            borderRadius: 'var(--radius)',
            background: isConnected ? 'rgba(50, 215, 75, 0.1)' : 'var(--bg-surface-2)',
            border: isConnected ? '1px solid rgba(50, 215, 75, 0.3)' : '1px solid var(--border)',
            marginBottom: '12px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: isConnected ? 'var(--success)' : 'var(--text-muted)' }}>
                {isConnected ? '🟢 Connected' : '⚪ Not Connected'}
              </div>
              {isConnected && stats?.telegram_username && (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  @{stats.telegram_username}
                </span>
              )}
            </div>
            {isConnected && (
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                ID: {stats.telegram_chat_id}
              </div>
            )}
          </div>

          {stats?.id && (
            <a
              href={`https://t.me/${botUsername}?start=connect_${stats.id}`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-primary"
              style={{
                width: '100%',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                minHeight: '38px',
                fontSize: '0.82rem'
              }}
            >
              🚀 {isConnected ? 'Reconnect Telegram Bot' : 'One-Click Connect Telegram'}
            </a>
          )}
        </div>

        <div style={{ marginTop: '20px' }}>
          <div className="drawer-item-label" style={{ marginBottom: '8px' }}>
            Your Client Referral Link
          </div>
          {(() => {
            const chatbotAdminOrigin = window.location.origin.replace(':5175', ':5174').replace(':3000', ':5174');
            const referralLink = `${chatbotAdminOrigin}/?ref=${stats?.id || '0'}`;
            return (
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  className="form-control"
                  readOnly
                  value={referralLink}
                  style={{ minHeight: '36px', padding: '8px', fontSize: '0.75rem' }}
                />
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    navigator.clipboard.writeText(referralLink);
                    alert('Referral link copied to clipboard!');
                  }}
                  style={{ minHeight: '36px' }}
                >
                  Copy
                </button>
              </div>
            );
          })()}
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
