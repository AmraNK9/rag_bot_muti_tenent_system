import React from 'react';
import { PlanRequest } from '../../../types';
import { getImgSrc, handleImgError } from '../../shared/ZoomModal';

interface RequestsTabProps {
  requests: PlanRequest[];
  loadingRequests: boolean;
  onApprove: (id: number, hasReseller: boolean) => Promise<void>;
  setZoomImgUrl: (url: string | null) => void;
}

export const RequestsTab: React.FC<RequestsTabProps> = ({
  requests,
  loadingRequests,
  onApprove,
  setZoomImgUrl,
}) => {
  if (loadingRequests) {
    return (
      <div className="loading-state">
        <div className="spinner" /> Loading requests...
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="card">
        <div className="empty-state">
          <div className="empty-state-icon">🗂️</div>
          <p>No active subscription requests.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="requests-grid">
      {requests.map((req) => (
        <div key={req.id} className="request-card">
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
                {req.business?.name || `Business #${req.business_id}`}
              </span>
              <span
                className={`badge ${
                  req.status === 'approved'
                    ? 'badge-green'
                    : req.status === 'rejected'
                    ? 'badge-red'
                    : 'badge-yellow'
                }`}
              >
                {req.status.toUpperCase()}
              </span>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <div>
                Plan:{' '}
                <strong style={{ color: 'var(--text-main)' }}>
                  {req.plan_name.toUpperCase()}
                </strong>{' '}
                · {Number(req.price).toLocaleString()} MMK
              </div>
              <div>
                Via: <strong>{req.reseller?.name || 'Central Office'}</strong>
              </div>
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

          {req.status === 'pending' && req.reseller_id === null && (
            <button
              className="btn btn-primary btn-sm"
              style={{ width: '100%' }}
              onClick={() => onApprove(req.id, false)}
            >
              ✅ Approve Request
            </button>
          )}
        </div>
      ))}
    </div>
  );
};
