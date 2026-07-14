import React, { useState } from 'react';
import { Reseller } from '../../../types';
import { updateReseller, getResellers } from '../../../api/client';

interface ResellersTabProps {
  resellers: Reseller[];
  loadingResellers: boolean;
  setResellers: (resellers: Reseller[]) => void;
}

export const ResellersTab: React.FC<ResellersTabProps> = ({
  resellers,
  loadingResellers,
  setResellers,
}) => {
  const [editingReseller, setEditingReseller] = useState<Reseller | null>(null);
  const [reliabilityScore, setReliabilityScore] = useState(100);
  const [canCollectPayments, setCanCollectPayments] = useState(false);
  const [commissionRate, setCommissionRate] = useState('');
  const [customReferrerFirstRate, setCustomReferrerFirstRate] = useState('');
  const [customReferrerRecurringRate, setCustomReferrerRecurringRate] = useState('');
  const [customApproverRate, setCustomApproverRate] = useState('');
  const [trustScoreFactor, setTrustScoreFactor] = useState(1.0);
  const [postpaidLimit, setPostpaidLimit] = useState(10000);
  const [canSell, setCanSell] = useState(true);
  const [updatingReseller, setUpdatingReseller] = useState(false);

  const handleOpenEditReseller = (reseller: Reseller) => {
    setEditingReseller(reseller);
    setReliabilityScore(reseller.reliability_score);
    setCanCollectPayments(reseller.can_collect_payments);
    setCommissionRate(reseller.commission_percentage === null ? '' : String(reseller.commission_percentage));
    setCustomReferrerFirstRate(
      reseller.custom_referrer_first_rate === null ? '' : String(reseller.custom_referrer_first_rate)
    );
    setCustomReferrerRecurringRate(
      reseller.custom_referrer_recurring_rate === null
        ? ''
        : String(reseller.custom_referrer_recurring_rate)
    );
    setCustomApproverRate(
      reseller.custom_approver_rate === null ? '' : String(reseller.custom_approver_rate)
    );
    setTrustScoreFactor(reseller.trust_score_factor === null ? 1.0 : Number(reseller.trust_score_factor));
    setPostpaidLimit(reseller.postpaid_limit !== undefined ? Number(reseller.postpaid_limit) : 10000);
    setCanSell(reseller.can_sell !== undefined ? reseller.can_sell : true);
  };

  const handleUpdateResellerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReseller) return;
    setUpdatingReseller(true);
    try {
      const res = await updateReseller(editingReseller.id, {
        reliability_score: reliabilityScore,
        can_collect_payments: canCollectPayments,
        commission_percentage: commissionRate === '' ? null : Number(commissionRate),
        custom_referrer_first_rate:
          customReferrerFirstRate === '' ? null : Number(customReferrerFirstRate),
        custom_referrer_recurring_rate:
          customReferrerRecurringRate === '' ? null : Number(customReferrerRecurringRate),
        custom_approver_rate: customApproverRate === '' ? null : Number(customApproverRate),
        trust_score_factor: Number(trustScoreFactor),
        postpaid_limit: Number(postpaidLimit),
        can_sell: canSell,
      });
      if (res.success) {
        alert('Reseller configurations updated successfully!');
        setEditingReseller(null);
        const reload = await getResellers();
        if (reload.success) setResellers(reload.resellers || []);
      }
    } catch (e) {
      alert('Failed to update reseller settings.');
    } finally {
      setUpdatingReseller(false);
    }
  };

  if (loadingResellers) {
    return (
      <div className="loading-state">
        <div className="spinner" /> Loading resellers...
      </div>
    );
  }

  if (resellers.length === 0) {
    return (
      <div className="card">
        <div className="empty-state">
          <div className="empty-state-icon">🤝</div>
          <p>No reseller accounts registered.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="resellers-list">
        {resellers.map((reseller) => (
          <div key={reseller.id} className="reseller-item-card">
            <div className="reseller-item-header">
              <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{reseller.name}</span>
              <span className="badge badge-purple">ID: {reseller.id}</span>
            </div>

            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              <div>{reseller.email}</div>
              <div style={{ marginTop: '2px' }}>
                KPay: {reseller.kpay_no} · {reseller.kpay_name}
              </div>
            </div>

            <div className="reseller-meta-row">
              <span>
                Top-Up Comm.{' '}
                <strong style={{ color: 'var(--text-main)' }}>
                  {reseller.commission_percentage !== null ? reseller.commission_percentage + '%' : 'Default'}
                </strong>
              </span>
              <span>
                Approve Comm.{' '}
                <strong style={{ color: 'var(--text-main)' }}>
                  {reseller.custom_approver_rate !== null ? reseller.custom_approver_rate + '%' : 'Default'}
                </strong>
              </span>
            </div>

            <div className="reseller-meta-row">
              <span>
                Collected{' '}
                <strong style={{ color: 'var(--success)' }}>
                  {reseller.total_collected.toLocaleString()} MMK
                </strong>
              </span>
              <span>
                Earned{' '}
                <strong style={{ color: 'var(--text-main)' }}>
                  {reseller.balance.toLocaleString()} MMK
                </strong>
              </span>
            </div>

            <div className="reseller-meta-row">
              <span>
                Prepaid{' '}
                <strong style={{ color: 'var(--primary)' }}>
                  {Number(reseller.prepaid_balance || 0).toLocaleString()} MMK
                </strong>
              </span>
            </div>

            <div className="reseller-meta-row">
              <span>
                Debt{' '}
                <strong
                  style={{
                    color:
                      (reseller.pending_debt || 0) > 0 ? 'var(--error)' : 'var(--text-main)',
                  }}
                >
                  {Number(reseller.pending_debt || 0).toLocaleString()} MMK
                </strong>{' '}
                / {Number(reseller.postpaid_limit || 0).toLocaleString()}
              </span>
              <span>
                Trust <strong>{reseller.reliability_score}/100</strong>
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '4px' }}>
                {reseller.can_collect_payments ? (
                  <span className="badge badge-green">Postpaid ✓</span>
                ) : (
                  <span className="badge badge-yellow">Prepaid</span>
                )}
                {!reseller.can_sell && <span className="badge badge-red">Suspended</span>}
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => handleOpenEditReseller(reseller)}
              >
                ✏️ Edit
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* EDIT RESELLER MODAL */}
      {editingReseller && (
        <div className="modal-overlay" onClick={() => setEditingReseller(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setEditingReseller(null)}>
              ×
            </button>
            <h3 style={{ marginBottom: '4px' }}>Edit Reseller</h3>
            <p style={{ marginBottom: '20px', fontSize: '0.8rem' }}>
              Updating: <strong>{editingReseller.name}</strong>
            </p>
            <form onSubmit={handleUpdateResellerSubmit}>
              <div className="form-group">
                <label>Trust Rating (0–100)</label>
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
                <label>Custom Top-Up Commission (%) — optional</label>
                <input
                  className="form-control"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  placeholder="Leave empty to use system default"
                  value={commissionRate}
                  onChange={(e) => setCommissionRate(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Custom Referrer First Rate (%) — optional</label>
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
                <label>Custom Referrer Renewal Rate (%) — optional</label>
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
                <label>Custom Approver Fee Rate (%) — optional</label>
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
                <label>Trust Score Factor (multiplier)</label>
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
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', margin: '16px 0' }}>
                <input
                  type="checkbox"
                  id="can-collect"
                  checked={canCollectPayments}
                  onChange={(e) => setCanCollectPayments(e.target.checked)}
                  style={{
                    width: '18px',
                    height: '18px',
                    accentColor: 'var(--primary)',
                    cursor: 'pointer',
                  }}
                />
                <label htmlFor="can-collect" style={{ cursor: 'pointer', fontSize: '0.875rem' }}>
                  Enable Postpaid Mode (can_collect_payments)
                </label>
              </div>
              <div className="form-group">
                <label>Postpaid Credit Limit (MMK)</label>
                <input
                  className="form-control"
                  type="number"
                  min="0"
                  required
                  value={postpaidLimit}
                  onChange={(e) => setPostpaidLimit(Number(e.target.value))}
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', margin: '16px 0' }}>
                <input
                  type="checkbox"
                  id="can-sell"
                  checked={canSell}
                  onChange={(e) => setCanSell(e.target.checked)}
                  style={{
                    width: '18px',
                    height: '18px',
                    accentColor: 'var(--primary)',
                    cursor: 'pointer',
                  }}
                />
                <label htmlFor="can-sell" style={{ cursor: 'pointer', fontSize: '0.875rem' }}>
                  Account Active (Can Approve Customers)
                </label>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
                <button
                  className="btn btn-ghost"
                  style={{ flex: 1 }}
                  type="button"
                  onClick={() => setEditingReseller(null)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  type="submit"
                  disabled={updatingReseller}
                >
                  {updatingReseller ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
