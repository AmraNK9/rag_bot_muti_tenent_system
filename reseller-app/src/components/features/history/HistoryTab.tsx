import React, { useState } from 'react';
import { PlanRequest, P2PTopupTransaction } from '../../../types';

interface HistoryTabProps {
  requestHistory: PlanRequest[];
  p2pHistory: P2PTopupTransaction[];
}

export const HistoryTab: React.FC<HistoryTabProps> = ({ requestHistory, p2pHistory }) => {
  const [historySubTab, setHistorySubTab] = useState<'approvals' | 'p2p'>('approvals');

  return (
    <div className="card animate-slide-up" style={{ padding: '24px 20px' }}>
      <h2 style={{ marginBottom: '20px' }}>📜 History Records</h2>

      {/* Sub-tab navigation */}
      <div className="auth-tabs" style={{ marginBottom: '24px', display: 'flex', gap: '8px' }}>
        <button
          className={`auth-tab ${historySubTab === 'approvals' ? 'active' : ''}`}
          onClick={() => setHistorySubTab('approvals')}
          style={{ flex: 1, padding: '10px', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
        >
          Subscription Approvals
        </button>
        <button
          className={`auth-tab ${historySubTab === 'p2p' ? 'active' : ''}`}
          onClick={() => setHistorySubTab('p2p')}
          style={{ flex: 1, padding: '10px', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
        >
          P2P Direct Top-Ups
        </button>
      </div>

      {/* Subscription Approvals Sub-tab */}
      {historySubTab === 'approvals' && (
        <>
          <h3 style={{ marginBottom: '16px', fontSize: '1.05rem', color: 'var(--text-muted)' }}>
            📋 Handled Subscription Upgrades
          </h3>
          {requestHistory.length === 0 ? (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No handled requests found.</p>
          ) : (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Business</th>
                    <th>Plan Requested</th>
                    <th>Price</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {requestHistory.map((item, idx) => (
                    <tr key={idx}>
                      <td>{new Date(item.created_at).toLocaleDateString()}</td>
                      <td style={{ fontWeight: 600 }}>
                        {item.business?.name || `Business #${item.business_id}`}
                      </td>
                      <td style={{ textTransform: 'uppercase' }}>{item.plan_name}</td>
                      <td>{Number(item.price).toLocaleString()} MMK</td>
                      <td>
                        {item.status === 'approved' && <span className="badge badge-green">Approved</span>}
                        {item.status === 'rejected' && <span className="badge badge-red">Rejected</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* P2P Direct Top-Ups Sub-tab */}
      {historySubTab === 'p2p' && (
        <>
          <h3 style={{ marginBottom: '16px', fontSize: '1.05rem', color: 'var(--text-muted)' }}>
            💎 Direct P2P Top-Up History
          </h3>
          {p2pHistory.length === 0 ? (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              No P2P top-up transactions found.
            </p>
          ) : (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Business Name (Top-Up ID)</th>
                    <th>Price Paid</th>
                    <th>Queries Added</th>
                    <th>Commission Earned</th>
                  </tr>
                </thead>
                <tbody>
                  {p2pHistory.map((item, idx) => (
                    <tr key={idx}>
                      <td>{new Date(item.created_at).toLocaleString()}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>
                          {item.business?.name || `Business #${item.business_id}`}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {item.business?.topup_id || '—'}
                        </div>
                      </td>
                      <td style={{ fontWeight: 'bold' }}>
                        {Number(item.package_price).toLocaleString()} MMK
                      </td>
                      <td style={{ color: 'var(--primary)', fontWeight: 600 }}>
                        +{Number(item.credit_amount).toLocaleString()}
                      </td>
                      <td style={{ color: 'var(--success)', fontWeight: 'bold' }}>
                        +{Number(item.commission_earned).toLocaleString()} MMK
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
};
