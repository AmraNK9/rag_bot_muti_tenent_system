import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useChatbot } from '../../contexts/ChatbotContext';
import { useToast } from '../../contexts/ToastContext';
import { updateChatbot, getSystemBotInfo } from '../../api/client';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

interface SidebarDrawerProps {
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  onSelectBilling: () => void;
}

export const SidebarDrawer: React.FC<SidebarDrawerProps> = ({ drawerOpen, setDrawerOpen, onSelectBilling }) => {
  const { profile, logout } = useAuth();
  const { chatbot, credits, businessPlanInfo, setChatbot } = useChatbot();
  const { showToast } = useToast();
  const { theme, setTheme } = useTheme();
  const { t, i18n } = useTranslation('auth');
  const { t: tc } = useTranslation('common');

  const [editName, setEditName] = useState(chatbot?.name || '');
  const [editDesc, setEditDesc] = useState(chatbot?.description || '');
  const [editToken, setEditToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [botUsername, setBotUsername] = useState('mock_bot');

  useEffect(() => {
    getSystemBotInfo()
      .then((res) => {
        if (res.success && res.username) {
          setBotUsername(res.username);
        }
      })
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    if (chatbot) {
      setEditName(chatbot.name);
      setEditDesc(chatbot.description || '');
      setEditToken('');
    }
  }, [chatbot]);

  const handleSave = async () => {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      const data = await updateChatbot(editName, editDesc, editToken || undefined);
      if (data.success && data.chatbot) {
        setChatbot(data.chatbot);
        setShowEdit(false);
        showToast('success', t('drawer.toast.botUpdatedTitle'), t('drawer.toast.botUpdatedMsg'));
      }
    } catch (e: any) {
      showToast('error', t('drawer.toast.updateFailedTitle'), e?.response?.data?.error || tc('tryAgain'));
    } finally {
      setSaving(false);
    }
  };

  const isTelegramConnected = !!businessPlanInfo?.telegram_chat_id;

  return (
    <>
      <div
        className={`drawer-overlay ${drawerOpen ? 'open' : ''}`}
        onClick={() => setDrawerOpen(false)}
      />
      <div className={`drawer ${drawerOpen ? 'open' : ''}`}>
        <div className="drawer-header">
          <h3>{t('drawer.title')}</h3>
          <button className="drawer-close" onClick={() => setDrawerOpen(false)}>✕</button>
        </div>

        <div className="drawer-content">
          {/* Credits */}
          <div className="credits-row">
            <span className="credits-label">{t('drawer.credits')}</span>
            <span className="credits-value">{credits}</span>
          </div>

          {/* Topup ID */}
          {businessPlanInfo?.topupId && (
            <div className="topup-pill" style={{ margin: '10px 16px' }}>
              <div className="topup-pill-label">Top-up ID (Reseller ကိုပေး)</div>
              <div className="topup-pill-value">{businessPlanInfo.topupId}</div>
            </div>
          )}

          {/* Profile Info */}
          <div className="drawer-section-title">Admin Profile</div>
          <div className="drawer-item">
            <span className="drawer-item-label">Name</span>
            <span className="drawer-item-val">{profile?.name}</span>
          </div>
          <div className="drawer-item">
            <span className="drawer-item-label">Email</span>
            <span className="drawer-item-val">{profile?.email}</span>
          </div>

          {/* Telegram Notifications Section */}
          <div className="drawer-section-title" style={{ marginTop: 8 }}>🔔 Telegram Alerts</div>
          <div style={{ padding: '0 16px 10px' }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px', lineHeight: '1.3' }}>
              Receive instant alerts for low credits, staff handoff requests, and plan approvals.
            </p>
            <div style={{
              padding: '10px 12px',
              borderRadius: 'var(--radius)',
              background: isTelegramConnected ? 'rgba(50, 215, 75, 0.1)' : 'var(--bg-surface-2)',
              border: isTelegramConnected ? '1px solid rgba(50, 215, 75, 0.3)' : '1px solid var(--border)',
              marginBottom: '10px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: isTelegramConnected ? 'var(--green)' : 'var(--text-muted)' }}>
                  {isTelegramConnected ? '🟢 Connected' : '⚪ Not Connected'}
                </span>
                {isTelegramConnected && businessPlanInfo?.telegram_username && (
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    @{businessPlanInfo.telegram_username}
                  </span>
                )}
              </div>
            </div>
            {businessPlanInfo?.id && (
              <a
                href={`https://t.me/${botUsername}?start=connect_business_${businessPlanInfo.id}`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-primary btn-sm"
                style={{
                  width: '100%',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxSizing: 'border-box'
                }}
              >
                🚀 {isTelegramConnected ? 'Reconnect Telegram Bot' : 'One-Click Connect Telegram'}
              </a>
            )}
          </div>

          {/* Billing Section */}
          <div className="drawer-section-title" style={{ marginTop: 8 }}>Billing & Account</div>
          <div 
            className="drawer-item" 
            onClick={() => {
              onSelectBilling();
              setDrawerOpen(false);
            }}
            style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'background-color 0.2s' }}
          >
            <span className="drawer-item-label" style={{ color: 'var(--text-main)', fontWeight: 500 }}>
              💳 Billing & Subscriptions
            </span>
            <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>❯</span>
          </div>

          {/* Bot settings */}
          {chatbot && (
            <>
              <div className="drawer-section-title" style={{ marginTop: 8 }}>Bot Configuration</div>
              {!showEdit ? (
                <>
                  <div className="drawer-item">
                    <span className="drawer-item-label">Bot Name</span>
                    <span className="drawer-item-val">{chatbot.name}</span>
                  </div>
                  <div className="drawer-item">
                    <span className="drawer-item-label">Type</span>
                    <span className="drawer-item-val" style={{ textTransform: 'capitalize' }}>{chatbot.type}</span>
                  </div>
                  <div className="drawer-item">
                    <span className="drawer-item-label">Role</span>
                    <span className="drawer-item-val" style={{ textTransform: 'capitalize' }}>{chatbot.bot_role}</span>
                  </div>
                  <div style={{ padding: '12px 16px' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ width: '100%' }}
                      onClick={() => setShowEdit(true)}
                    >
                      ✏️ Edit Bot Details
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Bot Name</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      placeholder="Bot name..."
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Description</label>
                    <textarea
                      rows={2}
                      value={editDesc}
                      onChange={e => setEditDesc(e.target.value)}
                      placeholder="Optional description..."
                      style={{ resize: 'none' }}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Bot Token</label>
                    <input
                      type="password"
                      value={editToken}
                      onChange={e => setEditToken(e.target.value)}
                      placeholder="Leave blank to keep existing token..."
                    />
                    <small style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                      Update only if you generated a new token from BotFather.
                    </small>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => setShowEdit(false)} disabled={saving}>
                      Cancel
                    </button>
                    <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving} style={{ flex: 1 }}>
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="drawer-footer">
          {/* Theme switcher */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            {(['light', 'system', 'dark'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setTheme(mode)}
                style={{
                  flex: 1,
                  padding: '8px 6px',
                  borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${theme === mode ? 'var(--primary)' : 'var(--border)'}`,
                  background: theme === mode ? 'var(--primary-bg)' : 'transparent',
                  color: theme === mode ? 'var(--primary)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  transition: 'all 0.2s ease',
                  textTransform: 'capitalize',
                }}
              >
                {mode === 'light' ? '☀️ Light' : mode === 'dark' ? '🌙 Dark' : '⚙️ Auto'}
              </button>
            ))}
          </div>

          {/* Language switcher */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            {(['my', 'en'] as const).map(lang => (
              <button
                key={lang}
                onClick={() => {
                  i18n.changeLanguage(lang);
                  localStorage.setItem('chatbot_admin_lang', lang);
                }}
                style={{
                  flex: 1,
                  padding: '8px 6px',
                  borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${i18n.language === lang ? 'var(--primary)' : 'var(--border)'}`,
                  background: i18n.language === lang ? 'var(--primary-bg)' : 'transparent',
                  color: i18n.language === lang ? 'var(--primary)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  transition: 'all 0.2s ease',
                }}
              >
                {lang === 'my' ? '🇲🇲 မြန်မာ' : '🇬🇧 English'}
              </button>
            ))}
          </div>
          <button className="btn btn-danger" onClick={logout} style={{ fontSize: '0.9rem' }}>
            {t('drawer.logout')}
          </button>
        </div>
      </div>
    </>
  );
};
