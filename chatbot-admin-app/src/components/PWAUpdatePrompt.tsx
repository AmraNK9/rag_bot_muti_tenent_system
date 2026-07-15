import { useState, useEffect } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';

const PWAUpdatePrompt: React.FC = () => {
  const [showUpdate, setShowUpdate] = useState(false);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('[PWA] Service Worker registered:', r);
    },
    onRegisterError(error) {
      console.error('[PWA] Service Worker registration error:', error);
    },
  });

  useEffect(() => {
    if (needRefresh) {
      setShowUpdate(true);
    }
  }, [needRefresh]);

  const handleUpdate = () => {
    updateServiceWorker(true);
    setShowUpdate(false);
  };

  const handleDismiss = () => {
    setNeedRefresh(false);
    setShowUpdate(false);
  };

  if (!showUpdate) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9998,
        width: 'calc(100% - 32px)',
        maxWidth: '420px',
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        border: '1px solid rgba(99, 102, 241, 0.4)',
        borderRadius: '14px',
        padding: '14px 18px',
        boxShadow: '0 20px 50px rgba(0,0,0,0.5), 0 0 0 1px rgba(99,102,241,0.1)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        animation: 'pwaDropDown 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}
    >
      {/* Icon */}
      <div
        style={{
          width: '38px',
          height: '38px',
          borderRadius: '10px',
          background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.2))',
          border: '1px solid rgba(99,102,241,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          animation: 'pwaSpin 3s linear infinite',
        }}
      >
        <RefreshCw size={18} color="#818cf8" />
      </div>

      {/* Text */}
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: '13px', color: '#f1f5f9', fontFamily: 'Inter, sans-serif' }}>
          အသစ် Version ရှိနေပါပြီ
        </p>
        <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#94a3b8', fontFamily: 'Inter, sans-serif' }}>
          Update ပြုလုပ်ရန် click နှိပ်ပါ
        </p>
      </div>

      {/* Update Button */}
      <button
        onClick={handleUpdate}
        style={{
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          padding: '7px 14px',
          fontSize: '12px',
          fontWeight: 600,
          cursor: 'pointer',
          flexShrink: 0,
          fontFamily: 'Inter, sans-serif',
        }}
      >
        Update
      </button>

      {/* Dismiss */}
      <button
        onClick={handleDismiss}
        style={{
          background: 'transparent',
          border: 'none',
          color: '#64748b',
          cursor: 'pointer',
          padding: '4px',
          borderRadius: '6px',
          display: 'flex',
          alignItems: 'center',
          flexShrink: 0,
        }}
        aria-label="Dismiss update"
      >
        <X size={15} />
      </button>

      <style>{`
        @keyframes pwaDropDown {
          from { opacity: 0; transform: translateX(-50%) translateY(-16px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes pwaSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default PWAUpdatePrompt;
