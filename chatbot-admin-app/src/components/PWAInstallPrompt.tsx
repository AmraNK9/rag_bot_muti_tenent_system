import { useState, useEffect } from 'react';
import { Download, X, Share, MoreVertical, Plus } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

type Platform = 'android' | 'ios' | 'desktop' | null;

const PWAInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [platform, setPlatform] = useState<Platform>(null);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (isStandalone) {
      setInstalled(true);
      return;
    }

    // Check if user dismissed before
    const dismissed = localStorage.getItem('pwa_install_dismissed');
    if (dismissed) {
      const dismissedTime = parseInt(dismissed, 10);
      const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < 7) return; // Don't show again for 7 days
    }

    // Detect platform
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) {
      setPlatform('ios');
      setTimeout(() => setShowPrompt(true), 3000);
    } else if (/android/.test(ua)) {
      setPlatform('android');
    } else {
      setPlatform('desktop');
    }

    // Listen for Android/Desktop install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setShowPrompt(true), 3000);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => {
      setInstalled(true);
      setShowPrompt(false);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (platform === 'ios') {
      setShowIOSGuide(true);
      return;
    }
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === 'accepted') {
      setInstalled(true);
    }
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setShowIOSGuide(false);
    localStorage.setItem('pwa_install_dismissed', Date.now().toString());
  };

  if (installed || (!showPrompt && !showIOSGuide)) return null;

  return (
    <>
      {/* Main Install Banner */}
      {showPrompt && !showIOSGuide && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            width: 'calc(100% - 32px)',
            maxWidth: '420px',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            border: '1px solid rgba(13, 148, 136, 0.4)',
            borderRadius: '16px',
            padding: '16px 20px',
            boxShadow: '0 25px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(13,148,136,0.1)',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            animation: 'pwaSlideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          {/* App Icon */}
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '12px',
              overflow: 'hidden',
              flexShrink: 0,
              background: 'linear-gradient(135deg, #0d9488, #10b981)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <img
              src="/logo.png"
              alt="PhyayPay"
              style={{ width: '40px', height: '40px', objectFit: 'contain' }}
            />
          </div>

          {/* Text */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: '14px', color: '#f1f5f9', fontFamily: 'Inter, sans-serif' }}>
              PhyayPay ကို Install ပြုလုပ်ပါ
            </p>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#94a3b8', fontFamily: 'Inter, sans-serif' }}>
              Home screen မှ လွယ်ကူစွာ ဖွင့်နိုင်မည်
            </p>
          </div>

          {/* Install Button */}
          <button
            onClick={handleInstall}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'linear-gradient(135deg, #0d9488, #10b981)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              padding: '8px 14px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              flexShrink: 0,
              fontFamily: 'Inter, sans-serif',
              whiteSpace: 'nowrap',
            }}
          >
            <Download size={14} />
            Install
          </button>

          {/* Close Button */}
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
              justifyContent: 'center',
              flexShrink: 0,
            }}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* iOS Step-by-Step Guide */}
      {showIOSGuide && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
          onClick={handleDismiss}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '480px',
              background: 'linear-gradient(160deg, #0f172a 0%, #1e293b 100%)',
              borderTopLeftRadius: '24px',
              borderTopRightRadius: '24px',
              padding: '24px 24px 40px',
              border: '1px solid rgba(13, 148, 136, 0.3)',
              animation: 'pwaSlideUp 0.3s ease',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <img src="/logo.png" alt="PhyayPay" style={{ width: '36px', height: '36px', borderRadius: '8px' }} />
                <div>
                  <p style={{ margin: 0, fontWeight: 700, color: '#f1f5f9', fontSize: '16px', fontFamily: 'Inter, sans-serif' }}>
                    PhyayPay Install ပြုလုပ်ရန်
                  </p>
                  <p style={{ margin: '2px 0 0', color: '#94a3b8', fontSize: '12px', fontFamily: 'Inter, sans-serif' }}>
                    Safari browser တွင် အောက်ပါ steps လုပ်ပါ
                  </p>
                </div>
              </div>
              <button onClick={handleDismiss} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '8px', color: '#94a3b8', cursor: 'pointer', padding: '6px' }}>
                <X size={18} />
              </button>
            </div>

            {/* Steps */}
            {[
              { icon: <Share size={20} color="#0d9488" />, step: '1', text: 'Safari browser ၏ Share button (↑) ကို နှိပ်ပါ' },
              { icon: <Plus size={20} color="#0d9488" />, step: '2', text: '"Add to Home Screen" ကို ရွေးပါ' },
              { icon: <MoreVertical size={20} color="#0d9488" />, step: '3', text: '"Add" ကို နှိပ်ပြီး ပြီးဆုံးပါပြီ 🎉' },
            ].map(({ icon, step, text }) => (
              <div key={step} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px', background: 'rgba(13,148,136,0.08)', borderRadius: '12px', marginBottom: '10px', border: '1px solid rgba(13,148,136,0.15)' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(13,148,136,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {icon}
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: '#0d9488', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: 'Inter, sans-serif' }}>Step {step}</span>
                  <p style={{ margin: '2px 0 0', color: '#cbd5e1', fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes pwaSlideUp {
          from { opacity: 0; transform: translateX(-50%) translateY(20px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </>
  );
};

export default PWAInstallPrompt;
