import React, { useState } from 'react';
import { DashboardStats, TopUpHistoryItem } from '../../../types';
import { submitTopUp } from '../../../api/client';

interface WalletTabProps {
  stats: DashboardStats | null;
  topups: TopUpHistoryItem[];
  fetchDashboard: () => Promise<void>;
  setZoomImgUrl: (url: string | null) => void;
}

export const WalletTab: React.FC<WalletTabProps> = ({
  stats,
  topups,
  fetchDashboard,
  setZoomImgUrl,
}) => {
  const [topupAmount, setTopupAmount] = useState('');
  const [topupReceiptBase64, setTopupReceiptBase64] = useState('');
  const [submittingTopUp, setSubmittingTopUp] = useState(false);
  const [topupStatusMsg, setTopupStatusMsg] = useState({ error: '', success: '' });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setTopupReceiptBase64(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleTopUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTopupStatusMsg({ error: '', success: '' });
    if (!topupAmount || Number(topupAmount) <= 0) {
      setTopupStatusMsg({ error: 'Please enter a valid paid amount.', success: '' });
      return;
    }
    if (!topupReceiptBase64) {
      setTopupStatusMsg({ error: 'Please select a receipt image.', success: '' });
      return;
    }
    setSubmittingTopUp(true);
    try {
      const type = stats?.can_collect_payments ? 'postpaid_settlement' : 'prepaid_topup';
      const credits = Math.floor(Number(topupAmount) / 10);
      const res = await submitTopUp(Number(topupAmount), credits, type, topupReceiptBase64);
      if (res.success) {
        setTopupStatusMsg({
          error: '',
          success: 'Top-up request submitted successfully! Pending admin approval.',
        });
        setTopupAmount('');
        setTopupReceiptBase64('');
        // Clear input file
        const fileInput = document.getElementById('topup-file-input') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
        fetchDashboard();
      }
    } catch (err: any) {
      setTopupStatusMsg({
        error: err.response?.data?.error || 'Failed to submit request',
        success: '',
      });
    } finally {
      setSubmittingTopUp(false);
    }
  };

  return (
    <>
      <div className="metrics-grid" style={{ marginBottom: '16px' }}>
        <div className="metric-card">
          <div className="metric-icon-bg">📈</div>
          <h3>Commission Balance</h3>
          <div className="metric-card-val" style={{ color: 'var(--success)' }}>
            {stats?.balance ? Number(stats.balance).toLocaleString() : '0'}
          </div>
        </div>

        {!stats?.can_collect_payments ? (
          <div className="metric-card">
            <div className="metric-icon-bg" style={{ background: 'var(--primary-glow)' }}>
              💳
            </div>
            <h3>Prepaid Wallet</h3>
            <div className="metric-card-val" style={{ color: 'var(--primary)' }}>
              {stats?.prepaid_balance ? Number(stats.prepaid_balance).toLocaleString() : '0'}
            </div>
          </div>
        ) : (
          <div
            className="metric-card"
            style={
              (stats?.pending_debt || 0) >= (stats?.postpaid_limit || 0)
                ? { border: '1px solid var(--danger)' }
                : {}
            }
          >
            <div
              className="metric-icon-bg"
              style={{
                background:
                  (stats?.pending_debt || 0) > 0 ? 'var(--danger-glow)' : 'var(--success-glow)',
              }}
            >
              ⚖️
            </div>
            <h3>Pending Debt</h3>
            <div
              className="metric-card-val"
              style={{
                color: (stats?.pending_debt || 0) > 0 ? 'var(--danger)' : 'var(--success)',
              }}
            >
              {stats?.pending_debt ? Number(stats.pending_debt).toLocaleString() : '0'}
            </div>
            <p style={{ fontSize: '0.75rem', marginTop: '6px' }}>
              Limit: {stats?.postpaid_limit?.toLocaleString()} MMK
            </p>
          </div>
        )}
      </div>

      {/* WALLET TOP-UP / SETTLEMENT */}
      <div className="card animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <h2 style={{ margin: 0 }}>
            {stats?.can_collect_payments ? '⚖️ Settle Pending Debt' : '💳 Wallet Top-Up'}
          </h2>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '32px',
          }}
        >
          {/* Form */}
          <div>
            <h3 style={{ marginBottom: '12px', fontSize: '0.95rem' }}>Submit Transfer Receipt</h3>
            <div className="wallet-info-box">
              <p style={{ fontSize: '0.85rem', lineHeight: 1.6 }}>
                {stats?.can_collect_payments
                  ? "Transfer cash to the Super Admin's KBZ Pay to clear your pending debt. Submit the exact amount paid and a receipt screenshot."
                  : "Transfer cash to the Super Admin's KBZ Pay to refill your prepaid wallet. Submit the amount and a receipt screenshot."}
              </p>
            </div>

            {topupStatusMsg.error && (
              <div className="alert alert-error" style={{ marginBottom: '16px' }}>
                ⚠️ {topupStatusMsg.error}
              </div>
            )}
            {topupStatusMsg.success && (
              <div className="alert alert-success" style={{ marginBottom: '16px' }}>
                ✅ {topupStatusMsg.success}
              </div>
            )}

            <form onSubmit={handleTopUpSubmit}>
              <div className="form-group">
                <label>Amount Paid (MMK)</label>
                <input
                  className="form-control"
                  type="number"
                  required
                  placeholder="e.g. 14000"
                  value={topupAmount}
                  onChange={(e) => setTopupAmount(e.target.value)}
                />
                {topupAmount && !stats?.can_collect_payments && (
                  <div style={{ fontSize: '0.8rem', marginTop: '8px', color: 'var(--success)' }}>
                    Estimated credit:{' '}
                    <strong>
                      {Math.round(
                        Number(topupAmount) /
                          (1 - Number(stats?.commissionPercentage || 30) / 100)
                      ).toLocaleString()}{' '}
                      MMK
                    </strong>
                  </div>
                )}
              </div>
              <div className="form-group">
                <label>KPay Receipt Screenshot</label>
                <input
                  id="topup-file-input"
                  className="form-control"
                  type="file"
                  accept="image/*"
                  required
                  onChange={handleFileChange}
                />
              </div>
              <button className="btn btn-primary" type="submit" disabled={submittingTopUp}>
                {submittingTopUp ? 'Submitting...' : 'Submit Top-up Request'}
              </button>
            </form>
          </div>

          {/* History */}
          <div>
            <h3 style={{ marginBottom: '10px', fontSize: '0.9rem' }}>Top-Up History</h3>
            {topups.length === 0 ? (
              <p
                style={{
                  fontSize: '0.82rem',
                  color: 'var(--text-dim)',
                  textAlign: 'center',
                  padding: '20px 0',
                }}
              >
                No top-up history yet.
              </p>
            ) : (
              <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
                {topups.map((t) => (
                  <div key={t.id} className="topup-history-item">
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                        {Number(t.amount_paid).toLocaleString()} MMK
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--success)', marginTop: '2px' }}>
                        +{Number(t.credit_amount).toLocaleString()} MMK credit
                      </div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', marginTop: '3px' }}>
                        {new Date(t.created_at).toLocaleString()}
                      </div>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-end',
                        gap: '6px',
                      }}
                    >
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setZoomImgUrl(t.screenshot_url)}
                        style={{ padding: '4px 10px', fontSize: '0.72rem', minHeight: '28px' }}
                      >
                        View
                      </button>
                      <span
                        className={`badge ${
                          t.status === 'approved'
                            ? 'badge-success'
                            : t.status === 'rejected'
                            ? 'badge-danger'
                            : 'badge-warning'
                        }`}
                      >
                        {t.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
