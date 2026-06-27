import React, { useState } from 'react';
import { Plan } from '../../../types';
import { createPlan, updatePlan, getPlans } from '../../../api/client';

interface PlansTabProps {
  plans: Plan[];
  loadingPlans: boolean;
  setPlans: (plans: Plan[]) => void;
}

export const PlansTab: React.FC<PlansTabProps> = ({ plans, loadingPlans, setPlans }) => {
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [creatingPlan, setCreatingPlan] = useState(false);

  const [planName, setPlanName] = useState('');
  const [planPrice, setPlanPrice] = useState(0);
  const [planQueryLimit, setPlanQueryLimit] = useState(0);
  const [planDurationDays, setPlanDurationDays] = useState(30);
  const [planIsActive, setPlanIsActive] = useState(true);
  const [planMaxChatHistory, setPlanMaxChatHistory] = useState(10);
  const [planServicesStr, setPlanServicesStr] = useState('');
  const [planIsOnlyP2p, setPlanIsOnlyP2p] = useState(false);
  const [updatingPlan, setUpdatingPlan] = useState(false);

  const handleOpenCreatePlan = () => {
    setEditingPlan(null);
    setCreatingPlan(true);
    setPlanName('');
    setPlanPrice(0);
    setPlanQueryLimit(0);
    setPlanDurationDays(30);
    setPlanIsActive(true);
    setPlanMaxChatHistory(10);
    setPlanServicesStr('');
    setPlanIsOnlyP2p(false);
  };

  const handleOpenEditPlan = (plan: Plan) => {
    setCreatingPlan(false);
    setEditingPlan(plan);
    setPlanName(plan.name);
    setPlanPrice(plan.price);
    setPlanQueryLimit(plan.query_limit);
    setPlanDurationDays(plan.duration_days);
    setPlanIsActive(plan.is_active);
    setPlanMaxChatHistory(plan.max_chat_history || 10);
    setPlanServicesStr((plan.services || []).join(', '));
    setPlanIsOnlyP2p(plan.is_only_p2p || false);
  };

  const handleSavePlanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdatingPlan(true);
    try {
      const services = planServicesStr
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      const data = {
        name: planName,
        price: Number(planPrice),
        query_limit: Number(planQueryLimit),
        duration_days: Number(planDurationDays),
        is_active: planIsActive,
        max_chat_history: Number(planMaxChatHistory),
        services,
        is_only_p2p: planIsOnlyP2p,
      };

      if (creatingPlan) {
        const res = await createPlan(data);
        if (res.success) alert('Plan created successfully!');
      } else if (editingPlan) {
        const res = await updatePlan(editingPlan.id, data);
        if (res.success) alert('Plan configuration updated successfully!');
      }

      setEditingPlan(null);
      setCreatingPlan(false);
      const reload = await getPlans();
      if (reload.success) setPlans(reload.plans || []);
    } catch (err) {
      alert('Failed to save plan.');
    } finally {
      setUpdatingPlan(false);
    }
  };

  if (loadingPlans) {
    return (
      <div className="loading-state">
        <div className="spinner" /> Loading plans...
      </div>
    );
  }

  return (
    <div className="card">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>Subscription Plans</h2>
          <p style={{ margin: 0 }}>Configure subscription plan tiers and limits.</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={handleOpenCreatePlan}>
          + Create New Plan
        </button>
      </div>

      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Plan</th>
              <th>Price (MMK)</th>
              <th>Queries</th>
              <th>Duration</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((plan) => (
              <tr key={plan.id}>
                <td>
                  <strong style={{ textTransform: 'uppercase' }}>{plan.name}</strong>
                </td>
                <td>{plan.price.toLocaleString()}</td>
                <td>{plan.query_limit.toLocaleString()}</td>
                <td>{plan.duration_days}d</td>
                <td>
                  {plan.is_active ? (
                    <span className="badge badge-green">Active</span>
                  ) : (
                    <span className="badge badge-red">Inactive</span>
                  )}
                  {plan.is_only_p2p && (
                    <span
                      className="badge"
                      style={{
                        backgroundColor: 'rgba(37, 99, 235, 0.1)',
                        color: 'rgb(37, 99, 235)',
                        marginLeft: '6px',
                      }}
                    >
                      P2P Only
                    </span>
                  )}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => handleOpenEditPlan(plan)}>
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* CREATE/EDIT PLAN MODAL */}
      {(editingPlan || creatingPlan) && (
        <div
          className="modal-overlay"
          onClick={() => {
            setEditingPlan(null);
            setCreatingPlan(false);
          }}
        >
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <button
              className="modal-close"
              onClick={() => {
                setEditingPlan(null);
                setCreatingPlan(false);
              }}
            >
              ×
            </button>
            <h3 style={{ marginBottom: '4px' }}>
              {creatingPlan ? (
                'Create New Plan'
              ) : (
                <>
                  Edit Plan:{' '}
                  <span style={{ textTransform: 'uppercase', color: 'var(--primary)' }}>
                    {editingPlan?.name}
                  </span>
                </>
              )}
            </h3>
            <p style={{ marginBottom: '20px', fontSize: '0.8rem' }}>
              Modify plan properties and AI limits.
            </p>
            <form onSubmit={handleSavePlanSubmit}>
              <div className="form-group">
                <label>Plan Name</label>
                <input
                  className="form-control"
                  type="text"
                  required
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                  placeholder="e.g. starter"
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="form-group">
                  <label>Price (MMK)</label>
                  <input
                    className="form-control"
                    type="number"
                    min="0"
                    required
                    value={planPrice}
                    onChange={(e) => setPlanPrice(Number(e.target.value))}
                  />
                </div>
                <div className="form-group">
                  <label>Query Limit</label>
                  <input
                    className="form-control"
                    type="number"
                    min="0"
                    required
                    value={planQueryLimit}
                    onChange={(e) => setPlanQueryLimit(Number(e.target.value))}
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="form-group">
                  <label>Duration (Days)</label>
                  <input
                    className="form-control"
                    type="number"
                    min="1"
                    required
                    value={planDurationDays}
                    onChange={(e) => setPlanDurationDays(Number(e.target.value))}
                  />
                </div>
                <div className="form-group">
                  <label>Max Chat History</label>
                  <input
                    className="form-control"
                    type="number"
                    min="1"
                    max="100"
                    required
                    value={planMaxChatHistory}
                    onChange={(e) => setPlanMaxChatHistory(Number(e.target.value))}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Services (Comma-separated)</label>
                <textarea
                  className="form-control"
                  rows={3}
                  value={planServicesStr}
                  onChange={(e) => setPlanServicesStr(e.target.value)}
                  placeholder="Live Chat, Priority Support, Analytics..."
                ></textarea>
              </div>
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: '10px', margin: '16px 0' }}
              >
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    id="plan-active"
                    checked={planIsActive}
                    onChange={(e) => setPlanIsActive(e.target.checked)}
                    style={{
                      width: '18px',
                      height: '18px',
                      accentColor: 'var(--primary)',
                      cursor: 'pointer',
                    }}
                  />
                  <label htmlFor="plan-active" style={{ cursor: 'pointer', fontSize: '0.875rem' }}>
                    Enable Plan (Available for purchase)
                  </label>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    id="plan-p2p-only"
                    checked={planIsOnlyP2p}
                    onChange={(e) => setPlanIsOnlyP2p(e.target.checked)}
                    style={{
                      width: '18px',
                      height: '18px',
                      accentColor: 'var(--primary)',
                      cursor: 'pointer',
                    }}
                  />
                  <label
                    htmlFor="plan-p2p-only"
                    style={{ cursor: 'pointer', fontSize: '0.875rem' }}
                  >
                    Is P2P Direct Top-Up Only (Reseller App Only)
                  </label>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
                <button
                  className="btn btn-ghost"
                  style={{ flex: 1 }}
                  type="button"
                  onClick={() => {
                    setEditingPlan(null);
                    setCreatingPlan(false);
                  }}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  type="submit"
                  disabled={updatingPlan}
                >
                  {updatingPlan ? 'Saving...' : 'Save Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
