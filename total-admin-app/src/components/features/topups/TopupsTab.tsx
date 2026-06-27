import React from 'react';
import { ResellerTopUp } from '../../../types';
import { getImgSrc, handleImgError } from '../../shared/ZoomModal';

interface TopupsTabProps {
  topups: ResellerTopUp[];
  loadingTopUps: boolean;
  onApproveTopUp: (id: number) => Promise<void>;
  onRejectTopUp: (id: number) => Promise<void>;
  setZoomImgUrl: (url: string | null) => void;
}

export const TopupsTab: React.FC<TopupsTabProps> = ({
  topups,
  loadingTopUps,
  onApproveTopUp,
  onRejectTopUp,
  setZoomImgUrl,
}) => {
  if (loadingTopUps) {
    return (
      <div className="loading-state">
        <div className="spinner" /> Loading top-ups...
      </div>
    );
  }

  if (topups.length === 0) {
    return (
      <div className="card">
        <div className="empty-state">
          <div className="empty-state-icon">💼</div>
          <p>No reseller top-up requests found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="requests-grid">
      {topups.map((t) => (
        <div key={t.id} className="request-card">
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px',
              }}
            >
              <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                {t.reseller?.name || `Reseller #${t.reseller_id}`}
              </span>
              <span
                className={`badge ${
                  t.status === 'approved'
                    ? 'badge-green'
                    : t.status === 'rejected'
                    ? 'badge-red'
                    : 'badge-yellow'
                }`}
              >
                {t.status.toUpperCase()}
              </span>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <div>
                Type:{' '}
                <strong style={{ color: 'var(--primary)' }}>
                  {t.type === 'postpaid_settlement' ? 'Postpaid Settlement' : 'Prepaid Top-up'}
                </strong>
              </div>
              <div>
                Paid:{' '}
                <strong style={{ color: 'var(--text-main)' }}>
                  {Number(t.amount_paid).toLocaleString()} MMK
                </strong>
              </div>
              {t.type !== 'postpaid_settlement' && (
                <div>
                  Credit:{' '}
                  <strong style={{ color: 'var(--success)' }}>
                    +{Number(t.credit_amount).toLocaleString()} MMK
                  </strong>
                </div>
              )}
              <div>Commission: {t.reseller?.commission_percentage || '30'}%</div>
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
              <button
                className="btn btn-ghost btn-sm"
                style={{ flex: 1 }}
                onClick={() => onRejectTopUp(t.id)}
              >
                Reject
              </button>
              <button
                className="btn btn-success btn-sm"
                style={{ flex: 1 }}
                onClick={() => onApproveTopUp(t.id)}
              >
                Approve
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
