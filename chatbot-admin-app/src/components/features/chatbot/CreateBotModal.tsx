import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useChatbot } from '../../../contexts/ChatbotContext';
import { createChatbot } from '../../../api/client';
import { TokenHelpModal } from './TokenHelpModal';
import { Bot, Briefcase, MessageCircleQuestion, Wrench, Zap, Info, Eye, EyeOff } from 'lucide-react';

const TelegramIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="#0a84ff">
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.892-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
  </svg>
);

const FacebookIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="#1877f2">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

interface CreateBotModalProps {
  onClose: () => void;
}

const PLATFORM_OPTIONS = [
  {
    value: 'telegram' as const,
    label: 'Telegram',
    icon: <TelegramIcon />,
    color: '#0a84ff',
    available: true,
  },
  {
    value: 'facebook' as const,
    label: 'Facebook',
    icon: <FacebookIcon />,
    color: '#1877f2',
    available: false,
    badge: 'Soon',
  },
];

const ROLE_OPTIONS = [
  { value: 'sales' as const, icon: <Briefcase size={22} />, labelKey: 'roleSales', descKey: 'roleSalesDesc' },
  { value: 'faq' as const, icon: <MessageCircleQuestion size={22} />, labelKey: 'roleFaq', descKey: 'roleFaqDesc' },
  { value: 'support' as const, icon: <Wrench size={22} />, labelKey: 'roleSupport', descKey: 'roleSupportDesc' },
  { value: 'custom' as const, icon: <Zap size={22} />, labelKey: 'roleCustom', descKey: 'roleCustomDesc' },
];

export const CreateBotModal: React.FC<CreateBotModalProps> = ({ onClose }) => {
  const { setChatbot, setShowInAppTour } = useChatbot();
  const { t } = useTranslation('bot');
  const { t: tc } = useTranslation('common');

  const [name, setName] = useState('');
  const [token, setToken] = useState('');
  const [type, setType] = useState<'telegram' | 'facebook'>('telegram');
  const [role, setRole] = useState<'sales' | 'faq' | 'support' | 'custom'>('sales');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [showForceConnect, setShowForceConnect] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  // P1: token field highlight after "Got it!"
  const [tokenHighlight, setTokenHighlight] = useState(false);
  const [tokenFocused, setTokenFocused] = useState(false);
  const tokenRef = useRef<HTMLInputElement>(null);
  const warningRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showForceConnect && warningRef.current) {
      warningRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [showForceConnect]);

  const handleHelpComplete = () => {
    setShowHelp(false);
    // Small delay so modal close animation finishes first
    setTimeout(() => {
      setTokenHighlight(true);
      tokenRef.current?.focus();
      setTimeout(() => setTokenHighlight(false), 3500);
    }, 180);
  };

  const handleCreate = async (e: React.FormEvent, force: boolean = false) => {
    e.preventDefault();
    setError('');
    setCreating(true);
    try {
      const data = await createChatbot(name, token, type, role, force, systemPrompt);
      if (data.success && data.chatbot) {
        setChatbot(data.chatbot);
        const inAppTourDone = localStorage.getItem('chatbot_admin_intro_completed');
        if (!inAppTourDone) {
          setShowInAppTour(true);
        }
        onClose();
      }
    } catch (e: any) {
      if (e?.response?.data?.errorCode === 'WEBHOOK_EXISTS') {
        setShowForceConnect(true);
        // We intentionally don't set global error here because we show the localized warning banner at the bottom.
      } else if (e?.response?.data?.errorCode === 'INVALID_TOKEN') {
        setError(t('invalidTokenError'));
      } else {
        setError(e?.response?.data?.error || 'Failed to create chatbot');
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <div className="modal-overlay">
        <div className={`modal ${showHelp ? 'modal-fullscreen' : ''}`}>
          {/* Drag handle */}
          <div className="modal-handle" />

          {showHelp ? (
            <TokenHelpModal
              onBack={() => setShowHelp(false)}
              onComplete={handleHelpComplete}
            />
          ) : (
            <>
              {/* Header */}
              <div className="modal-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: 'var(--primary-bg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Bot size={20} color="var(--primary)" />
              </div>
              <h2>{t('createTitle')}</h2>
            </div>
            <button
              type="button"
              className="btn-icon"
              onClick={onClose}
              aria-label="Close"
              style={{ fontSize: '1.1rem' }}
            >
              ✕
            </button>
          </div>

          {/* Body */}
          <div className="modal-body">
            {/* Error banner */}
            {error && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 14px',
                  background: 'rgba(255,69,58,0.12)',
                  border: '1px solid rgba(255,69,58,0.25)',
                  borderRadius: 'var(--radius-sm)',
                  marginBottom: 18,
                  fontSize: '0.85rem',
                  color: 'var(--red)',
                  lineHeight: 1.4,
                }}
              >
                <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* ── Bot Name ── */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.6px',
                    marginBottom: 8,
                  }}
                >
                  {t('botName')}
                </label>
                <input
                  type="text"
                  placeholder={t('botNamePlaceholder')}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    background: 'var(--bg-surface-2)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '13px 16px',
                    color: 'var(--text-main)',
                    fontFamily: 'var(--font)',
                    fontSize: '0.95rem',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = 'rgba(10,132,255,0.5)')}
                  onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
                />
              </div>

              {/* ── Platform selection ── */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.6px',
                    marginBottom: 8,
                  }}
                >
                  {t('platform')}
                </label>
                <div style={{ display: 'flex', gap: 10 }}>
                  {PLATFORM_OPTIONS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      disabled={!p.available}
                      onClick={() => p.available && setType(p.value)}
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 6,
                        padding: '14px 10px',
                        borderRadius: 'var(--radius-sm)',
                        border: `1.5px solid ${
                          type === p.value
                            ? p.color
                            : 'var(--border)'
                        }`,
                        background:
                          type === p.value
                            ? `${p.color}18`
                            : 'var(--bg-surface-2)',
                        cursor: p.available ? 'pointer' : 'not-allowed',
                        opacity: p.available ? 1 : 0.45,
                        transition: 'all 0.2s ease',
                        position: 'relative',
                        fontFamily: 'var(--font)',
                      }}
                    >
                      {p.badge && (
                        <span
                          style={{
                            position: 'absolute',
                            top: 6,
                            right: 8,
                            fontSize: '0.58rem',
                            fontWeight: 700,
                            color: 'var(--text-muted)',
                            background: 'var(--bg-surface)',
                            border: '0.5px solid var(--border)',
                            borderRadius: 5,
                            padding: '1px 5px',
                            letterSpacing: '0.3px',
                          }}
                        >
                          {p.badge}
                        </span>
                      )}
                      <span style={{ fontSize: '1.4rem', lineHeight: 1 }}>{p.icon}</span>
                      <span
                        style={{
                          fontSize: '0.82rem',
                          fontWeight: 600,
                          color:
                            type === p.value ? p.color : 'var(--text-muted)',
                          transition: 'color 0.2s',
                        }}
                      >
                        {p.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Bot Token ── */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 8,
                  }}
                >
                  <label
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.6px',
                    }}
                  >
                    {t('botToken')}
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowHelp(true)}
                    style={{
                      background: 'var(--primary-bg)',
                      border: '1px solid rgba(10,132,255,0.25)',
                      borderRadius: 20,
                      color: 'var(--primary)',
                      cursor: 'pointer',
                      fontFamily: 'var(--font)',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      padding: '3px 10px',
                      letterSpacing: '0.1px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      transition: 'all 0.15s',
                      animation: !token ? 'buttonPulse 1.5s infinite' : 'none',
                    }}
                  >
                    <Info size={14} /> {t('howToGet')}
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  {/* P1: paste-here hint label when highlight is active */}
                  {tokenHighlight && (
                    <div
                      style={{
                        position: 'absolute',
                        top: -26,
                        left: 0,
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        color: 'var(--primary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        animation: 'tokenHintPulse 0.8s ease infinite alternate',
                      }}
                    >
                      {t('tokenHelp.tokenFieldHighlightHint')}
                    </div>
                  )}
                  <input
                    ref={tokenRef}
                    type={showToken ? 'text' : 'password'}
                    placeholder={t('tokenPlaceholder')}
                    value={token}
                    onChange={(e) => {
                      setToken(e.target.value);
                      if (error) setError('');
                    }}
                    required
                    style={{
                      width: '100%',
                      background: 'var(--bg-surface-2)',
                      border: error
                        ? '1.5px solid var(--red)'
                        : tokenHighlight || (!token && !tokenFocused)
                        ? '1px solid var(--primary)'
                        : tokenFocused
                        ? '1px solid var(--primary)'
                        : '1px solid var(--border)',
                      boxShadow: tokenHighlight
                        ? '0 0 0 4px rgba(10,132,255,0.18)'
                        : 'none',
                      borderRadius: 'var(--radius-sm)',
                      padding: '13px 54px 13px 16px',
                      color: 'var(--text-main)',
                      fontFamily: 'var(--font)',
                      fontSize: '0.9rem',
                      outline: 'none',
                      transition: 'border-color 0.25s, box-shadow 0.4s',
                      letterSpacing: showToken ? 'normal' : '0.1em',
                      animation: error 
                        ? 'pulseError 2s infinite'
                        : !token && !tokenHighlight 
                        ? 'pulseHighlight 2.5s infinite' 
                        : 'none',
                    }}
                    onFocus={() => setTokenFocused(true)}
                    onBlur={() => setTokenFocused(false)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken((v) => !v)}
                    style={{
                      position: 'absolute',
                      right: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'var(--bg-surface)',
                      border: '0.5px solid var(--border)',
                      borderRadius: 8,
                      cursor: 'pointer',
                      color: 'var(--text-muted)',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      fontFamily: 'var(--font)',
                      padding: '4px 8px',
                      lineHeight: 1,
                      transition: 'all 0.15s',
                    }}
                  >
                    {showToken ? <><EyeOff size={14} style={{ marginRight: 4 }} /> {tc('hide')}</> : <><Eye size={14} style={{ marginRight: 4 }} /> {tc('show')}</>}
                  </button>
                </div>
              </div>

              {/* ── Primary Role ── */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.6px',
                    marginBottom: 8,
                  }}
                >
                  {t('primaryRole')}
                </label>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 8,
                  }}
                >
                  {ROLE_OPTIONS.map((r) => (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => setRole(r.value)}
                      style={{
                        width: '100%',           /* fill grid cell fully */
                        display: 'flex',
                        flexDirection: 'column', /* vertical: icon → label → desc */
                        alignItems: 'flex-start',
                        gap: 6,
                        padding: '12px 12px',
                        borderRadius: 'var(--radius-sm)',
                        border: `1.5px solid ${
                          role === r.value ? 'var(--primary)' : 'var(--border)'
                        }`,
                        background:
                          role === r.value
                            ? 'var(--primary-bg)'
                            : 'var(--bg-surface-2)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        textAlign: 'left',
                        fontFamily: 'var(--font)',
                        boxSizing: 'border-box',
                      }}
                    >
                      <span style={{ fontSize: '1.3rem', lineHeight: 1 }}>{r.icon}</span>
                      <div style={{ width: '100%', minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: '0.82rem',
                            fontWeight: 700,
                            color: role === r.value ? 'var(--primary)' : 'var(--text-main)',
                            transition: 'color 0.2s',
                            marginBottom: 2,
                            wordBreak: 'break-word',   /* prevent label overflow */
                          }}
                        >
                          {t(r.labelKey)}
                        </div>
                        <div
                          style={{
                            fontSize: '0.67rem',
                            color: 'var(--text-muted)',
                            lineHeight: 1.4,
                            wordBreak: 'break-word',   /* allow wrapping */
                          }}
                        >
                          {t(r.descKey)}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Custom System Prompt (only for Custom role) ── */}
              {role === 'custom' && (
                <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.6px',
                      marginBottom: 8,
                    }}
                  >
                    {t('customPromptTitle')}
                  </label>
                  <textarea
                    placeholder={t('customPromptPlaceholder')}
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    required
                    rows={4}
                    style={{
                      width: '100%',
                      background: 'var(--bg-surface-2)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '13px 16px',
                      color: 'var(--text-main)',
                      fontFamily: 'var(--font)',
                      fontSize: '0.9rem',
                      outline: 'none',
                      resize: 'vertical',
                      minHeight: '80px',
                      transition: 'border-color 0.2s',
                    }}
                    onFocus={(e) => (e.target.style.borderColor = 'var(--primary)')}
                    onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
                  />
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {t('customPromptHint')}
                  </div>
                </div>
              )}

              {/* ── Action buttons ── */}
              {showForceConnect && (
                <div 
                  style={{ padding: '12px', background: 'rgba(255, 149, 0, 0.1)', border: '1px solid var(--orange)', borderRadius: 'var(--radius)', marginBottom: 16 }}
                >
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <Info size={18} color="var(--orange)" style={{ marginTop: 2, flexShrink: 0 }} />
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-main)', lineHeight: 1.4 }}>
                      {t('webhookConflictWarning')}
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={onClose}
                  disabled={creating}
                  style={{ flex: 1 }}
                >
                  {t('cancel')}
                </button>
                {showForceConnect ? (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={creating}
                    onClick={(e) => handleCreate(e as any, true)}
                    style={{ flex: 2, background: 'var(--orange)', color: '#fff', border: 'none' }}
                  >
                    {creating ? (
                      <>
                        <div
                          className="spinner"
                          style={{ width: 14, height: 14, borderWidth: 2 }}
                        />
                        {t('connecting')}
                      </>
                    ) : (
                      <>{t('forceConnect')}</>
                    )}
                  </button>
                ) : (
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={creating}
                    style={{ flex: 2 }}
                  >
                    {creating ? (
                      <>
                        <div
                          className="spinner"
                          style={{ width: 14, height: 14, borderWidth: 2 }}
                        />
                        {t('connecting')}
                      </>
                    ) : (
                      <>{t('connectBot')}</>
                    )}
                  </button>
                )}
              </div>
              
              {/* Invisible element at the very bottom to ensure full scroll */}
              <div ref={warningRef} style={{ height: 1 }} />
            </form>
          </div>
          </>
        )}
        </div>
      </div>
      {/* P3: keyframe for token field highlight pulse */}
      <style>{`
        @keyframes tokenHintPulse {
          from { opacity: 0.7; transform: translateX(0); }
          to   { opacity: 1;   transform: translateX(3px); }
        }
        @keyframes pulseHighlight {
          0% { box-shadow: 0 0 0 0 rgba(10,132,255,0.3); }
          70% { box-shadow: 0 0 0 5px rgba(10,132,255,0); }
          100% { box-shadow: 0 0 0 0 rgba(10,132,255,0); }
        }
        @keyframes pulseError {
          0% { box-shadow: 0 0 0 0 rgba(255,59,48,0.3); }
          70% { box-shadow: 0 0 0 5px rgba(255,59,48,0); }
          100% { box-shadow: 0 0 0 0 rgba(255,59,48,0); }
        }
        @keyframes buttonPulse {
          0% { box-shadow: 0 0 0 0 rgba(10,132,255,0.8); transform: scale(1); }
          50% { box-shadow: 0 0 0 10px rgba(10,132,255,0); transform: scale(1.05); }
          100% { box-shadow: 0 0 0 0 rgba(10,132,255,0); transform: scale(1); }
        }
      `}</style>
    </>
  );
};
