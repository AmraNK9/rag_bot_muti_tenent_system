import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useChatbot } from '../../contexts/ChatbotContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { Sun, Moon, Monitor, Settings, Zap, LogOut, ChevronRight } from 'lucide-react';

interface SidebarDrawerProps {
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  onOpenSettings: () => void;
}

export const SidebarDrawer: React.FC<SidebarDrawerProps> = ({ drawerOpen, setDrawerOpen, onOpenSettings }) => {
  const { profile, logout } = useAuth();
  const { credits, businessPlanInfo } = useChatbot();
  const { theme, setTheme } = useTheme();
  const { t, i18n } = useTranslation('auth');
  const { t: tc } = useTranslation('common');

  const isTelegramConnected = businessPlanInfo?.telegram_chat_id != null;
  const planLimit: number = businessPlanInfo?.plan_query_limit ?? 0;
  const creditPct = planLimit > 0 ? Math.max(0, Math.min(100, (credits / planLimit) * 100)) : 0;
  const creditLow = planLimit > 0 && credits < planLimit * 0.2;

  // Avatar: first letter of name
  const avatarLetter = (profile?.name || 'U').charAt(0).toUpperCase();

  return (
    <>
      <div
        className={`drawer-overlay ${drawerOpen ? 'open' : ''}`}
        onClick={() => setDrawerOpen(false)}
      />
      <div className={`drawer ${drawerOpen ? 'open' : ''}`}>
        {/* ── Header ── */}
        <div className="drawer-header">
          <h3>{t('drawer.title')}</h3>
          <button className="drawer-close" onClick={() => setDrawerOpen(false)}>✕</button>
        </div>

        <div className="drawer-content">

          {/* ── User Identity Card ── */}
          <div style={{
            margin: '0 16px 16px',
            padding: '16px',
            background: 'var(--bg-surface-2)',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}>
            {/* Avatar circle */}
            <div style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--primary), #5e5ce6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.2rem',
              fontWeight: 700,
              color: '#fff',
              flexShrink: 0,
              boxShadow: '0 2px 8px rgba(10,132,255,0.35)',
            }}>
              {avatarLetter}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {profile?.name}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {profile?.email}
              </div>
            </div>
          </div>

          {/* ── Credits & Topup (Standalone Only) ── */}
          {profile?.isStandalone && (
            <>
              {/* ── Credits Progress Pill ── */}
              <div style={{ margin: '0 16px 16px' }}>
                <div style={{
                  padding: '12px 14px',
                  background: 'var(--bg-surface-2)',
                  borderRadius: 'var(--radius)',
                  border: `1px solid ${creditLow ? 'rgba(255,59,48,0.4)' : 'var(--border)'}`,
                }}>
                  {/* Label row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                      <Zap size={13} fill="currentColor" color={creditLow ? 'var(--red)' : 'var(--primary)'} />
                      {tc('settings.availableCredits')}
                    </div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: creditLow ? 'var(--red)' : 'var(--primary)' }}>
                      {credits.toLocaleString()}
                      {planLimit > 0 && (
                        <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                          {' '}/ {planLimit.toLocaleString()}
                        </span>
                      )}
                    </span>
                  </div>

                  {/* Progress bar */}
                  {planLimit > 0 && (
                    <div style={{ height: 5, borderRadius: 4, background: 'var(--border)', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${creditPct}%`,
                        borderRadius: 4,
                        background: creditLow
                          ? 'linear-gradient(90deg, #ff3b30, #ff9500)'
                          : 'linear-gradient(90deg, var(--primary), #5e5ce6)',
                        transition: 'width 0.5s ease',
                      }} />
                    </div>
                  )}

                  {creditLow && (
                    <p style={{ margin: '6px 0 0', fontSize: '0.72rem', color: 'var(--red)', lineHeight: 1.4 }}>
                      ⚠️ Credits နည်းနေပါပြီ — ဖြည့်ပေးပါ
                    </p>
                  )}
                </div>

                {/* Upgrade Plan button only */}
                <div style={{ marginTop: 8 }}>
                  <button
                    className="btn btn-primary btn-sm"
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: '0.82rem', padding: '10px' }}
                    onClick={() => { setDrawerOpen(false); onOpenSettings(); }}
                  >
                    <Zap size={14} fill="currentColor" /> {tc('drawer.upgradeBtn')}
                  </button>
                </div>
              </div>

              {/* ── Top-up ID ── */}
              {businessPlanInfo?.topupId && (
                <div className="topup-pill" style={{ margin: '0 16px 16px' }}>
                  <div className="topup-pill-label">Top-up ID (Reseller ကိုပေး)</div>
                  <div className="topup-pill-value">{businessPlanInfo.topupId}</div>
                </div>
              )}
            </>
          )}

          {/* ── Account & Settings Gateway ── */}
          <div style={{ padding: '0 16px 8px' }}>
            <button
              className="btn btn-secondary"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '13px 16px',
                background: 'var(--bg-surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
              }}
              onClick={() => {
                setDrawerOpen(false);
                onOpenSettings();
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 600, color: 'var(--text-main)' }}>
                <span style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 28, height: 28, borderRadius: 8,
                  background: 'rgba(10, 132, 255, 0.12)', color: 'var(--primary)',
                }}>
                  <Settings size={15} />
                </span>
                {tc('settings.title')}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {!isTelegramConnected && (
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--red)', display: 'block' }} />
                )}
                <ChevronRight size={16} color="var(--text-muted)" />
              </div>
            </button>
          </div>

        </div>

        {/* ── Footer: Theme + Language + Logout ── */}
        <div className="drawer-footer">
          {/* Segmented Control: Theme */}
          <div style={{
            display: 'flex',
            background: 'var(--bg-page)',
            padding: 3,
            borderRadius: 'var(--radius-sm)',
            marginBottom: 8,
            border: '1px solid var(--border)'
          }}>
            {(['light', 'system', 'dark'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setTheme(mode)}
                style={{
                  flex: 1,
                  padding: '6px 4px',
                  borderRadius: 'calc(var(--radius-sm) - 2px)',
                  border: 'none',
                  background: theme === mode ? 'var(--bg-surface)' : 'transparent',
                  color: theme === mode ? 'var(--primary)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  boxShadow: theme === mode ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                {mode === 'light' ? <Sun size={13} /> : mode === 'dark' ? <Moon size={13} /> : <Monitor size={13} />}
                <span style={{ fontSize: '0.72rem', fontWeight: 600 }}>
                  {mode === 'light' ? 'Light' : mode === 'dark' ? 'Dark' : 'Auto'}
                </span>
              </button>
            ))}
          </div>

          {/* Segmented Control: Language */}
          <div style={{
            display: 'flex',
            background: 'var(--bg-page)',
            padding: 3,
            borderRadius: 'var(--radius-sm)',
            marginBottom: 12,
            border: '1px solid var(--border)'
          }}>
            {(['my', 'en'] as const).map(lang => (
              <button
                key={lang}
                onClick={() => { i18n.changeLanguage(lang); localStorage.setItem('chatbot_admin_lang', lang); }}
                style={{
                  flex: 1,
                  padding: '6px 4px',
                  borderRadius: 'calc(var(--radius-sm) - 2px)',
                  border: 'none',
                  background: i18n.language === lang ? 'var(--bg-surface)' : 'transparent',
                  color: i18n.language === lang ? 'var(--primary)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  boxShadow: i18n.language === lang ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                <span>{lang === 'my' ? '🇲🇲' : '🇬🇧'}</span>
                <span style={{ fontSize: '0.72rem', fontWeight: 600 }}>
                  {lang === 'my' ? 'မြန်မာ' : 'English'}
                </span>
              </button>
            ))}
          </div>

          <button className="btn btn-danger" onClick={logout} style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <LogOut size={16} /> {t('drawer.logout')}
          </button>
        </div>
      </div>
    </>
  );
};
