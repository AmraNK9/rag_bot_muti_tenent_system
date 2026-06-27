import React, { useState, useEffect } from 'react';
import { SystemSetting } from '../../../types';
import { updateSystemSettings } from '../../../api/client';

interface SettingsTabProps {
  settings: SystemSetting | null;
  loadingSettings: boolean;
  setSettings: (settings: SystemSetting | null) => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  settings,
  loadingSettings,
  setSettings,
}) => {
  const [referrerFirstMonthRate, setReferrerFirstMonthRate] = useState(30);
  const [referrerRecurringRate, setReferrerRecurringRate] = useState(10);
  const [approverFeeRate, setApproverFeeRate] = useState(10);
  const [updatingSettings, setUpdatingSettings] = useState(false);

  useEffect(() => {
    if (settings) {
      setReferrerFirstMonthRate(Number(settings.referrer_first_month_rate));
      setReferrerRecurringRate(Number(settings.referrer_recurring_rate));
      setApproverFeeRate(Number(settings.approver_fee_rate));
    }
  }, [settings]);

  const handleUpdateSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdatingSettings(true);
    try {
      const res = await updateSystemSettings({
        referrer_first_month_rate: Number(referrerFirstMonthRate),
        referrer_recurring_rate: Number(referrerRecurringRate),
        approver_fee_rate: Number(approverFeeRate),
      });
      if (res.success) {
        alert('Global commission settings updated successfully!');
        setSettings(res.settings);
      }
    } catch (err) {
      alert('Failed to update global commission settings.');
    } finally {
      setUpdatingSettings(false);
    }
  };

  if (loadingSettings && !settings) {
    return (
      <div className="card">
        <div className="loading-state">
          <div className="spinner" /> Loading settings...
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="card">
        <h2>⚙️ Commission Settings</h2>
        {settings && (
          <p style={{ color: 'var(--success)', fontSize: '0.78rem', marginBottom: '12px' }}>
            ✓ System defaults synced (Config ID: {settings.id})
          </p>
        )}
        <p style={{ marginBottom: '16px' }}>
          Default commission rates across the platform when no reseller overrides are active.
        </p>
        <form onSubmit={handleUpdateSettingsSubmit}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '14px',
              marginBottom: '16px',
            }}
          >
            <div className="form-group" style={{ margin: 0 }}>
              <label>Referrer First Month (%)</label>
              <input
                className="form-control"
                type="number"
                min="0"
                max="100"
                step="0.01"
                required
                value={referrerFirstMonthRate}
                onChange={(e) => setReferrerFirstMonthRate(Number(e.target.value))}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Referrer Renewal (%)</label>
              <input
                className="form-control"
                type="number"
                min="0"
                max="100"
                step="0.01"
                required
                value={referrerRecurringRate}
                onChange={(e) => setReferrerRecurringRate(Number(e.target.value))}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Approver Fee (%)</label>
              <input
                className="form-control"
                type="number"
                min="0"
                max="100"
                step="0.01"
                required
                value={approverFeeRate}
                onChange={(e) => setApproverFeeRate(Number(e.target.value))}
              />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              className="btn btn-primary"
              style={{ width: 'auto' }}
              type="submit"
              disabled={updatingSettings}
            >
              {updatingSettings ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
