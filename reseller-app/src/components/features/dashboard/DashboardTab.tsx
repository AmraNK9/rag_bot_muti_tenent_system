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
      {/* COMPACT WALLET STRIP */}
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
