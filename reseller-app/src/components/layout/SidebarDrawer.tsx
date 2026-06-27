import React from 'react';
import { DashboardStats } from '../../types';

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
  if (!drawerOpen) return null;

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

        <div style={{ marginTop: '32px' }}>
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
