import React, { useState } from 'react';
import { Plan } from '../../../types';
import { verifyTopupId, submitP2PTopup } from '../../../api/client';

interface P2PTabProps {
  p2pPackages: Plan[];
  fetchDashboard: () => Promise<void>;
}

export const P2PTab: React.FC<P2PTabProps> = ({ p2pPackages, fetchDashboard }) => {
  const [p2pTopupId, setP2pTopupId] = useState('');
  const [p2pVerifiedName, setP2pVerifiedName] = useState<string | null>(null);
  const [p2pSelectedPackage, setP2pSelectedPackage] = useState<Plan | null>(null);
  const [p2pLoading, setP2pLoading] = useState(false);
  const [p2pStatusMsg, setP2pStatusMsg] = useState({ error: '', success: '' });

  const handleVerifyP2PId = async () => {
    if (!p2pTopupId.trim()) return;
    setP2pLoading(true);
    setP2pStatusMsg({ error: '', success: '' });
    try {
      const res = await verifyTopupId(p2pTopupId.trim());
      if (res.success) {
        setP2pVerifiedName(res.maskedName);
      }
    } catch (err: any) {
      setP2pVerifiedName(null);
      setP2pStatusMsg({ error: err.response?.data?.error || 'User not found.', success: '' });
    } finally {
      setP2pLoading(false);
    }
  };

  const handleP2PSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('handleP2PSubmit called with:', { p2pTopupId, p2pSelectedPackage });
    if (!p2pTopupId || !p2pSelectedPackage) {
      console.warn('p2pTopupId or p2pSelectedPackage is missing');
      return;
    }
    setP2pLoading(true);
    setP2pStatusMsg({ error: '', success: '' });
    try {
      const priceVal = Number(p2pSelectedPackage.price);
      console.log('Submitting P2P Top-up:', { topupId: p2pTopupId.trim(), price: priceVal, queryLimit: p2pSelectedPackage.query_limit });
      const res = await submitP2PTopup(p2pTopupId.trim(), priceVal, p2pSelectedPackage.query_limit);
      console.log('P2P Top-up response:', res);
      if (res.success) {
        setP2pStatusMsg({
          error: '',
          success: `Top-up successful! Commission earned: ${res.commissionEarned} MMK`,
        });
        setP2pVerifiedName(null);
        setP2pTopupId('');
        setP2pSelectedPackage(null);
        fetchDashboard();
      }
    } catch (err: any) {
      console.error('P2P Top-up execution failed:', err);
      setP2pStatusMsg({ error: err.response?.data?.error || 'Top-up failed.', success: '' });
    } finally {
      setP2pLoading(false);
    }
  };

  return (
    <div className="card animate-fade-in" style={{ padding: '24px 20px', minHeight: '60vh' }}>
      <h2 style={{ marginBottom: '16px', fontSize: '1.3rem' }}>💎 P2P Direct Top-Up</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '24px' }}>
        Top up AI Query Credits directly for your client's Business using their Unique Top-Up ID.
      </p>

      {/* Verification Step */}
      <div className="form-group">
        <label>Business Top-Up ID</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            className="form-control"
            type="text"
            placeholder="UID-XXXXXX"
            value={p2pTopupId}
            onChange={(e) => {
              setP2pTopupId(e.target.value);
              setP2pVerifiedName(null);
              setP2pStatusMsg({ error: '', success: '' });
            }}
          />
          <button
            className="btn btn-secondary"
            onClick={handleVerifyP2PId}
            disabled={p2pLoading || !p2pTopupId.trim()}
          >
            {p2pLoading && !p2pVerifiedName ? '...' : 'Verify'}
          </button>
        </div>
      </div>

      {p2pStatusMsg.error && (
        <div className="alert alert-danger" style={{ marginTop: '16px' }}>
          {p2pStatusMsg.error}
        </div>
      )}
      {p2pStatusMsg.success && (
        <div className="alert alert-success" style={{ marginTop: '16px' }}>
          {p2pStatusMsg.success}
        </div>
      )}

      {/* Submission Step */}
      {p2pVerifiedName && (
        <form
          onSubmit={handleP2PSubmit}
          className="animate-slide-up"
          style={{
            marginTop: '24px',
            padding: '16px',
            background: 'var(--bg-main)',
            borderRadius: '12px',
            border: '1px solid var(--border)',
          }}
        >
          <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: 'var(--primary)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
              }}
            >
              {p2pVerifiedName.charAt(0)}
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Verified Business
              </div>
              <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{p2pVerifiedName}</div>
            </div>
          </div>

          <div className="form-group" style={{ marginTop: '20px' }}>
            <label>Select Top-Up Package</label>
            <div
              className="requests-grid"
              style={{
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                marginTop: '8px',
              }}
            >
              {p2pPackages.map((pkg) => (
                <div
                  key={pkg.id}
                  className="request-card"
                  style={{
                    cursor: 'pointer',
                    padding: '12px',
                    border:
                      p2pSelectedPackage?.id === pkg.id
                        ? '2px solid var(--primary)'
                        : '1px solid var(--border)',
                    background:
                      p2pSelectedPackage?.id === pkg.id
                        ? 'rgba(37, 99, 235, 0.05)'
                        : 'var(--bg-card)',
                  }}
                  onClick={() => setP2pSelectedPackage(pkg)}
                >
                  <div style={{ fontWeight: 'bold', fontSize: '0.9rem', textTransform: 'uppercase' }}>
                    {pkg.name}
                  </div>
                  <div style={{ color: 'var(--primary)', fontWeight: 'bold', marginTop: '4px' }}>
                    {Number(pkg.price).toLocaleString()} MMK
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    +{pkg.query_limit.toLocaleString()} Queries
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '24px', padding: '12px', fontSize: '1rem' }}
            disabled={p2pLoading || !p2pSelectedPackage}
          >
            {p2pLoading ? (
              'Processing...'
            ) : p2pSelectedPackage ? (
              `Confirm Top-Up (${Number(p2pSelectedPackage.price).toLocaleString()} MMK)`
            ) : (
              'Select a Package'
            )}
          </button>
        </form>
      )}
    </div>
  );
};
