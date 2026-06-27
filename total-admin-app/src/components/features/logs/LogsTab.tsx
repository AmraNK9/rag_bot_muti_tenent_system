import React from 'react';
import { AuditLog } from '../../../types';

interface LogsTabProps {
  logs: AuditLog[];
  loadingLogs: boolean;
}

export const LogsTab: React.FC<LogsTabProps> = ({ logs, loadingLogs }) => {
  if (loadingLogs) {
    return (
      <div className="card">
        <div className="loading-state">
          <div className="spinner" /> Loading audit logs...
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h2>📜 System Audit Logs</h2>
      <p style={{ marginBottom: '16px', color: 'var(--text-muted)' }}>
        Tracks all critical system changes and admin actions.
      </p>

      {logs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">✅</div>
          <p>No audit logs found.</p>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Action Type</th>
                <th>Description</th>
                <th>Admin ID</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log, idx) => (
                <tr key={idx}>
                  <td>{new Date(log.created_at).toLocaleString()}</td>
                  <td>
                    <span className="badge badge-purple">{log.action}</span>
                  </td>
                  <td>{log.description}</td>
                  <td>{log.admin_id || 'System'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
