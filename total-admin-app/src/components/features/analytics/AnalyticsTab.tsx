import React from 'react';
import { Analytics } from '../../../types';

interface AnalyticsTabProps {
  analytics: Analytics | null;
  loadingAnalytics: boolean;
}

export const AnalyticsTab: React.FC<AnalyticsTabProps> = ({
  analytics,
  loadingAnalytics,
}) => {
  if (loadingAnalytics && !analytics) {
    return (
      <div className="loading-state">
        <div className="spinner" /> Loading analytics...
      </div>
    );
  }

  return (
    <>
      <div className="metrics-grid">
        <div className="metric-card">
          <h3>Total Revenue</h3>
          <div className="metric-card-val" style={{ color: 'var(--success)' }}>
            {analytics?.totalRevenue ? Number(analytics.totalRevenue).toLocaleString() : '0'} MMK
          </div>
          <p style={{ fontSize: '0.7rem', marginTop: '4px' }}>Lifetime approved revenue</p>
        </div>
        <div className="metric-card">
          <h3>Active Resellers</h3>
          <div className="metric-card-val">{analytics?.totalResellers || '0'}</div>
          <p style={{ fontSize: '0.7rem', marginTop: '4px' }}>Registered agents</p>
        </div>
        <div className="metric-card">
          <h3>Active Businesses</h3>
          <div className="metric-card-val">{analytics?.totalBusinesses || '0'}</div>
          <p style={{ fontSize: '0.7rem', marginTop: '4px' }}>Registered businesses</p>
        </div>
        <div className="metric-card">
          <h3>Active Chatbots</h3>
          <div className="metric-card-val">{analytics?.activeChatbots || '0'}</div>
          <p style={{ fontSize: '0.7rem', marginTop: '4px' }}>Total chatbots running</p>
        </div>
        <div className="metric-card">
          <h3>LLM Costs</h3>
          <div className="metric-card-val" style={{ color: 'var(--danger)', fontSize: '1.3rem' }}>
            ${analytics?.totalApiCost ? Number(analytics.totalApiCost).toFixed(4) : '0.00'}
          </div>
          <p style={{ fontSize: '0.7rem', marginTop: '4px' }}>Cumulative API spend</p>
        </div>
      </div>

      <div className="card">
        <h2>📈 Daily Activity Logs</h2>
        {!analytics?.activities || analytics?.activities.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📭</div>
            <p>No activity records yet.</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Chatbot</th>
                  <th>Queries</th>
                  <th>API Cost</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody>
                {analytics?.activities?.map((log) => (
                  <tr key={log.id}>
                    <td>{log.activity_date}</td>
                    <td>
                      #{log.chatbot_id} {log.chatbot?.name ? `(${log.chatbot.name})` : ''}
                    </td>
                    <td>
                      <strong>{log.query_count}</strong>
                    </td>
                    <td style={{ color: 'var(--danger)' }}>
                      ${Number(log.api_cost).toFixed(5)}
                    </td>
                    <td>{Math.round(log.active_duration_seconds / 60)} min</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
};
