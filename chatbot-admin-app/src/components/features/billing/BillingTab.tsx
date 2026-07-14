import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useChatbot } from '../../../contexts/ChatbotContext';
import type { Plan } from '../../../types';
import { getPlans, getPaymentMethods, submitUpgrade, getSubscriptionHistory } from '../../../api/client';

export const BillingTab: React.FC = () => {
  const { loadProfileData } = useChatbot();
  const { t } = useTranslation('billing');

  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [kpayDetails, setKpayDetails] = useState<{ resellerId: number | null; kpay_no: string; kpay_name: string; note?: string } | null>(null);
  const [loadingKpay, setLoadingKpay] = useState(false);
  const [receiptBase64, setReceiptBase64] = useState<string | null>(null);
  const [receiptFilename, setReceiptFilename] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [upgradeMsg, setUpgradeMsg] = useState('');
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchHistory = () => {
    setLoadingHistory(true);
    getSubscriptionHistory()
      .then((res) => {
        if (res.success && res.history) setHistory(res.history);
      })
      .catch(console.error)
      .finally(() => setLoadingHistory(false));
  };

  useEffect(() => {
    getPlans().then(res => {
      if (res.success && res.plans) {
        const filtered = res.plans.filter((p: any) => !p.is_only_p2p && !p.isOnlyP2p);
        setPlans(filtered);
      }
    }).catch(console.error);

    fetchHistory();
  }, []);

  const handleSelectPlan = async (plan: Plan) => {
    setSelectedPlan(plan);
    setKpayDetails(null);
    setReceiptBase64(null);
    setReceiptFilename('');
    setUpgradeMsg('');
    setLoadingKpay(true);
    try {
      const data = await getPaymentMethods(plan.name);
      if (data.success) {
        setKpayDetails({
          resellerId: data.resellerId !== undefined ? data.resellerId : null,
          kpay_no: data.kpay_no || '',
          kpay_name: data.kpay_name || '',
          note: data.note || ''
        });
      }
    } catch (e) { console.error(e); }
    finally { setLoadingKpay(false); }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReceiptFilename(file.name);
    const reader = new FileReader();
    reader.onload = ev => setReceiptBase64((ev.target?.result as string) || null);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!selectedPlan || !receiptBase64) return;
    setSubmitting(true);
    setUpgradeMsg('');
    try {
      const data = await submitUpgrade(selectedPlan.name, receiptBase64, kpayDetails?.resellerId || null);
      if (data.success) {
        setUpgradeMsg('success');
        setSelectedPlan(null);
        setReceiptBase64(null);
        setReceiptFilename('');
        loadProfileData();
        fetchHistory();
      }
    } catch (e: any) {
      setUpgradeMsg(e?.response?.data?.error || 'Submission failed');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="tab-pane">
      <div className="tab-pane-header">
        <h2>{t('title')}</h2>
        <p>{t('subtitle')}</p>
      </div>

      {/* Success message */}
      {upgradeMsg === 'success' && (
        <div style={{ margin: '0 14px 14px' }} className="alert-box alert-success">
          {t('successMsg')}
        </div>
      )}
      {upgradeMsg && upgradeMsg !== 'success' && (
        <div style={{ margin: '0 14px 14px' }} className="alert-box alert-error">⚠️ {upgradeMsg}</div>
      )}

      {/* Plans */}
      <div style={{ padding: '0 14px 12px' }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 10 }}>
          {t('selectPackage')}
        </div>
      </div>
      <div className="plans-grid">
        {plans.map(p => (
          <div
            key={p.id}
            className={`plan-card ${selectedPlan?.id === p.id ? 'selected' : ''}`}
            onClick={() => handleSelectPlan(p)}
          >
            <h3>{p.name}</h3>
            <div className="price">{Number(p.price).toLocaleString()} Ks</div>
            <ul className="plan-features">
              <li>{p.query_limit} {t('messages')}</li>
              <li>{p.duration_days} {t('days')}</li>
              <li>{p.max_chat_history} {t('historyLimit')}</li>
            </ul>
          </div>
        ))}
      </div>

      {/* Payment section */}
      {selectedPlan && (
        <div className="payment-box">
          <div style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: 12, color: 'var(--text-muted)' }}>
            {t('paymentDetails', { planName: selectedPlan.name.toUpperCase() })}
          </div>

          {loadingKpay ? (
            <div className="loading-row"><div className="spinner" /> {t('fetchingInfo')}</div>
          ) : kpayDetails ? (
            <>
              <div className="kpay-info-box">
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 6 }}>{t('transferTo')}</div>
                <div className="kpay-number">{kpayDetails.kpay_no}</div>
                <div className="kpay-name">{kpayDetails.kpay_name}</div>
                {kpayDetails.note && (
                  <div style={{ fontSize: '0.78rem', color: 'var(--orange)', marginTop: 8, lineHeight: 1.4 }}>
                    ⚠️ {kpayDetails.note}
                  </div>
                )}
              </div>

              <div className="form-group" style={{ marginBottom: 12 }}>
                <label>{t('uploadScreenshot')}</label>
                <div>
                  <label htmlFor="receipt-file" style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: 8, padding: '12px 16px', background: 'var(--bg-surface-2)',
                    border: '1.5px dashed var(--border)', borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer', fontSize: '0.87rem', color: 'var(--text-muted)',
                    transition: 'border-color 0.2s'
                  }}>
                    <span style={{ marginRight: 6 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                    </span>
                    {receiptFilename || t('chooseFile')}
                  </label>
                  <input
                    id="receipt-file"
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                </div>
              </div>

              {receiptBase64 && (
                <div style={{ marginBottom: 14, textAlign: 'center' }}>
                  <img
                    src={receiptBase64}
                    alt="Receipt"
                    style={{ maxWidth: '100%', maxHeight: 180, borderRadius: 10, border: '1px solid var(--border)' }}
                  />
                </div>
              )}

              <button
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={submitting || !receiptBase64}
              >
                {submitting ? <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> {t('submitting')}</> : t('submitPayment')}
              </button>
            </>
          ) : (
            <div className="alert-box alert-error">{t('notAvailable')}</div>
          )}
        </div>
      )}

      {/* Billing History Section */}
      <div style={{ marginTop: 24, padding: '0 14px 14px' }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 12 }}>
          {t('historyTitle')}
        </div>

        {loadingHistory ? (
          <div className="loading-row"><div className="spinner" /> {t('loadingHistory')}</div>
        ) : history.length === 0 ? (
          <div style={{
            padding: '24px 16px',
            textAlign: 'center',
            background: 'var(--bg-surface-2)',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border)',
            color: 'var(--text-muted)',
            fontSize: '0.86rem'
          }}>
            {t('noHistory')}
          </div>
        ) : (
          <div style={{
            overflowX: 'auto',
            background: 'var(--bg-surface-2)',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border)'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--inset-bg)' }}>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>{t('colDate')}</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>{t('colPackage')}</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>{t('colAmount')}</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600, textAlign: 'center' }}>{t('colStatus')}</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h: any) => (
                  <tr key={h.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 12px' }}>{new Date(h.created_at).toLocaleDateString()}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 600, textTransform: 'uppercase' }}>{h.plan_name}</td>
                    <td style={{ padding: '10px 12px' }}>{Number(h.price).toLocaleString()} Ks</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <span className={`badge ${h.status === 'approved' ? 'badge-green' : h.status === 'rejected' ? 'badge-red' : 'badge-gray'}`} style={{ textTransform: 'uppercase', fontSize: '0.68rem', padding: '2px 6px' }}>
                        {h.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
