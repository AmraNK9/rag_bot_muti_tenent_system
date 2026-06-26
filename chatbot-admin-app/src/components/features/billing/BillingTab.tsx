import React, { useState, useEffect } from 'react';
import { useChatbot } from '../../../contexts/ChatbotContext';
import type { Plan } from '../../../types';
import { getPlans, getPaymentMethods, submitUpgrade } from '../../../api/client';

export const BillingTab: React.FC = () => {
  const { loadProfileData } = useChatbot();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [kpayDetails, setKpayDetails] = useState<{ resellerId: number | null; kpay_no: string; kpay_name: string; note?: string } | null>(null);
  const [loadingKpay, setLoadingKpay] = useState(false);
  const [receiptBase64, setReceiptBase64] = useState<string | null>(null);
  const [receiptFilename, setReceiptFilename] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [upgradeMsg, setUpgradeMsg] = useState('');

  useEffect(() => {
    getPlans().then(res => {
      if (res.success && res.plans) {
        const filtered = res.plans.filter((p: any) => !p.is_only_p2p && !p.isOnlyP2p);
        setPlans(filtered);
      }
    }).catch(console.error);
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
      }
    } catch (e: any) {
      setUpgradeMsg(e?.response?.data?.error || 'Submission failed');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="tab-pane">
      <div className="tab-pane-header">
        <h2>Billing</h2>
        <p>Message Credits ဝယ်ယူပြီး Bot ကို ဆက်လက်အသုံးပြုပါ</p>
      </div>

      {/* Success message */}
      {upgradeMsg === 'success' && (
        <div style={{ margin: '0 14px 14px' }} className="alert-box alert-success">
          ✅ Payment submitted! Admin approval ရသည်နှင့် Credits ထည့်ပေးပါမည်။
        </div>
      )}
      {upgradeMsg && upgradeMsg !== 'success' && (
        <div style={{ margin: '0 14px 14px' }} className="alert-box alert-error">⚠️ {upgradeMsg}</div>
      )}

      {/* Plans */}
      <div style={{ padding: '0 14px 12px' }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 10 }}>
          Select a Package
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
              <li>{p.query_limit} Messages</li>
              <li>{p.duration_days} Days</li>
              <li>{p.max_chat_history} History</li>
            </ul>
          </div>
        ))}
      </div>

      {/* Payment section */}
      {selectedPlan && (
        <div className="payment-box">
          <div style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: 12, color: 'var(--text-muted)' }}>
            PAYMENT DETAILS — {selectedPlan.name.toUpperCase()}
          </div>

          {loadingKpay ? (
            <div className="loading-row"><div className="spinner" /> Fetching payment info...</div>
          ) : kpayDetails ? (
            <>
              <div className="kpay-info-box">
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 6 }}>Transfer to KPay:</div>
                <div className="kpay-number">{kpayDetails.kpay_no}</div>
                <div className="kpay-name">{kpayDetails.kpay_name}</div>
                {kpayDetails.note && (
                  <div style={{ fontSize: '0.78rem', color: 'var(--orange)', marginTop: 8, lineHeight: 1.4 }}>
                    ⚠️ {kpayDetails.note}
                  </div>
                )}
              </div>

              <div className="form-group" style={{ marginBottom: 12 }}>
                <label>Upload Screenshot</label>
                <div>
                  <label htmlFor="receipt-file" style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: 8, padding: '12px 16px', background: 'var(--bg-surface-2)',
                    border: '1.5px dashed var(--border)', borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer', fontSize: '0.87rem', color: 'var(--text-muted)',
                    transition: 'border-color 0.2s'
                  }}>
                    📷 {receiptFilename || 'Choose payment screenshot'}
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
                {submitting ? <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Submitting...</> : '✅ Submit Payment'}
              </button>
            </>
          ) : (
            <div className="alert-box alert-error">Payment info not available</div>
          )}
        </div>
      )}
    </div>
  );
};
