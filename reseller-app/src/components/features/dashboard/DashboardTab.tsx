import React from 'react';
import { DashboardStats, PlanRequest } from '../../../types';
import { getImgSrc, handleImgError } from '../../shared/ZoomModal';

interface DashboardTabProps {
  stats: DashboardStats | null;
  requests: PlanRequest[];
  loadingDashboard: boolean;
  onApprove: (id: number) => Promise<void>;
  onReject: (id: number) => Promise<void>;
  setZoomImgUrl: (url: string | null) => void;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({
  stats,
  requests,
  loadingDashboard,
  onApprove,
  onReject,
  setZoomImgUrl,
}) => {
  if (loadingDashboard && !stats) {
    return (
      <div className="loading-state">
        <div className="spinner" /> Loading dashboard...
      </div>
    );
  }

  return (
    <>
      {/* ACCOUNT ALERTS */}
      {!stats?.can_sell && (
        <div className="alert alert-error" style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '1.2rem' }}>⚠️</div>
          <div>
            <strong>Account Suspended</strong>
            <p style={{ margin: 0, fontSize: '0.8rem' }}>
              Your account is suspended and you cannot approve plans or sell credits. Please contact admin.
            </p>
          </div>
        </div>
      )}

      {stats?.can_collect_payments === false && (stats?.pending_debt || 0) > 0 && (
        <div className="alert alert-warning" style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '1.2rem' }}>💳</div>
          <div>
            <strong>Prepaid Mode Enforced</strong>
            <p style={{ margin: 0, fontSize: '0.8rem' }}>
              Due to pending debt ({Number(stats?.pending_debt).toLocaleString()} MMK), your postpaid collection capability has been revoked. Clear your debt to restore it.
            </p>
          </div>
        </div>
      )}

      {/* ACCOUNT RATES & STATUS */}
      <div className="card" style={{ marginBottom: '16px', padding: '16px' }}>
        <h3 style={{ marginBottom: '12px', fontSize: '0.9rem', color: 'var(--text-dim)' }}>📊 Commission Rates & Status</h3>
        <div className="metrics-grid" style={{ gap: '8px', marginBottom: '0' }}>
          <div className="metric-item">
            <span className="metric-label">Top-Up Comm:</span>
            <strong style={{ color: 'var(--primary)' }}>{stats?.commissionPercentage}%</strong>
          </div>
          <div className="metric-item">
            <span className="metric-label">Approve Comm:</span>
            <strong style={{ color: 'var(--success)' }}>{stats?.approverRate}%</strong>
          </div>
          <div className="metric-item">
            <span className="metric-label">Refer (New):</span>
            <strong>{stats?.referrerFirstRate}%</strong>
          </div>
          <div className="metric-item">
            <span className="metric-label">Refer (Renew):</span>
            <strong>{stats?.referrerRecRate}%</strong>
          </div>
          <div className="metric-item">
            <span className="metric-label">Can Sell:</span>
            {stats?.can_sell ? <span className="badge badge-green">Yes</span> : <span className="badge badge-danger">Suspended</span>}
          </div>
          <div className="metric-item">
            <span className="metric-label">Postpaid Mode:</span>
            {stats?.can_collect_payments ? <span className="badge badge-blue">Active</span> : <span className="badge badge-warning">Disabled</span>}
          </div>
        </div>
      </div>

      {/* COMPACT WALLET STRIP */}
      <div className="compact-wallet-strip animate-slide-up">
        <div className="wallet-chip">
          <div className="wallet-chip-label">Top-Up Comm.</div>
          <div className="wallet-chip-val" style={{ color: 'var(--success)' }}>
            {stats?.topupCommission ? Number(stats.topupCommission).toLocaleString() : '0'}
          </div>
        </div>
        <div className="wallet-chip">
          <div className="wallet-chip-label">Approve Comm.</div>
          <div className="wallet-chip-val" style={{ color: 'var(--success)' }}>
            {stats?.approveCommission ? Number(stats.approveCommission).toLocaleString() : '0'}
          </div>
        </div>
        <div className="wallet-chip">
          <div className="wallet-chip-label">Total Earned</div>
          <div className="wallet-chip-val" style={{ color: 'var(--primary)' }}>
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
          <div
            className="wallet-chip"
            style={
              (stats?.pending_debt || 0) >= (stats?.postpaid_limit || 0)
                ? { border: '1px solid rgba(239, 68, 68, 0.4)' }
                : {}
            }
          >
            <div
              className="wallet-chip-label"
              style={{
                color: (stats?.pending_debt || 0) > 0 ? 'var(--danger)' : 'var(--text-muted)',
              }}
            >
              Pending Debt
            </div>
            <div
              className="wallet-chip-val"
              style={{
                color: (stats?.pending_debt || 0) > 0 ? 'var(--danger)' : 'var(--success)',
              }}
            >
              {stats?.pending_debt ? Number(stats.pending_debt).toLocaleString() : '0'}
            </div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Limit: {stats?.postpaid_limit?.toLocaleString()} MMK
            </div>
          </div>
        )}
      </div>

      {/* APPROVAL QUEUE */}
      <div className="card">
        <h2>
          📥 Upgrade Requests
          <span
            style={{
              marginLeft: '8px',
              fontSize: '0.78rem',
              fontWeight: 400,
              color: 'var(--text-muted)',
            }}
          >
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
              const approverFee =
                Number(req.price) * (appRate / 100) * (reliability / 100) * trustFactor;
              const netRequiredPrice = Number(req.price) - approverFee;

              const canCoverPrepaid = Number(stats?.prepaid_balance || 0) >= netRequiredPrice;
              const canCoverPostpaid =
                Number(stats?.pending_debt || 0) + netRequiredPrice <=
                Number(stats?.postpaid_limit || 0);
              const hasInsufficientBalance = !canCoverPrepaid && !canCoverPostpaid;
              const isSuspended = !stats?.can_sell;

              return (
                <div key={req.id} className="request-card">
                  <div>
                    <div className="request-meta-row">
                      <span style={{ fontWeight: 700 }}>
                        {req.business?.name || `Business #${req.business_id}`}
                      </span>
                      <span className="badge badge-blue">{req.plan_name.toUpperCase()}</span>
                    </div>
                    <div
                      className="request-meta-row"
                      style={{ marginTop: '4px', color: 'var(--text-muted)', fontSize: '0.8rem' }}
                    >
                      <span>{Number(req.price).toLocaleString()} MMK</span>
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
                      ⚠️ Insufficient limit. Need {Math.round(netRequiredPrice).toLocaleString()}{' '}
                      MMK (Prepaid: {Number(stats?.prepaid_balance || 0).toLocaleString()}, Debt:{' '}
                      {Number(stats?.pending_debt || 0).toLocaleString()} /{' '}
                      {Number(stats?.postpaid_limit || 0).toLocaleString()})
                    </div>
                  )}

                  <div className="request-actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => onReject(req.id)}>
                      Reject
                    </button>
                    <button
                      className="btn btn-success btn-sm"
                      onClick={() => onApprove(req.id)}
                      disabled={hasInsufficientBalance || isSuspended}
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
    </>
  );
};
