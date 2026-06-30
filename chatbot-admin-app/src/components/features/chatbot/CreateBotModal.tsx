import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useChatbot } from '../../../contexts/ChatbotContext';
import { createChatbot } from '../../../api/client';
import { TokenHelpModal } from './TokenHelpModal';
import { Bot, Briefcase, MessageCircleQuestion, Wrench, Zap, Info } from 'lucide-react';

interface CreateBotModalProps {
  onClose: () => void;
}

const PLATFORM_OPTIONS = [
  {
    value: 'telegram' as const,
    label: 'Telegram',
    icon: '✈️',
    color: '#0a84ff',
    available: true,
  },
  {
    value: 'facebook' as const,
    label: 'Facebook',
    icon: '📘',
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
  const { setChatbot } = useChatbot();
  const { t } = useTranslation('bot');
  const { t: tc } = useTranslation('common');

  const [name, setName] = useState('');
  const [token, setToken] = useState('');
  const [type, setType] = useState<'telegram' | 'facebook'>('telegram');
  const [role, setRole] = useState<'sales' | 'faq' | 'support' | 'custom'>('sales');
  const [showToken, setShowToken] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  // P1: token field highlight after "Got it!"
  const [tokenHighlight, setTokenHighlight] = useState(false);
  const [tokenFocused, setTokenFocused] = useState(false);
  const tokenRef = React.useRef<HTMLInputElement>(null);

  const handleHelpComplete = () => {
    setShowHelp(false);
    // Small delay so modal close animation finishes first
    setTimeout(() => {
      setTokenHighlight(true);
      tokenRef.current?.focus();
      setTimeout(() => setTokenHighlight(false), 3500);
    }, 180);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCreating(true);
    try {
      const data = await createChatbot(name, token, type, role);
      if (data.success && data.chatbot) {
        setChatbot(data.chatbot);
        onClose();
      }
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to create chatbot');
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
                    onChange={(e) => setToken(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      background: 'var(--bg-surface-2)',
                      border: tokenHighlight
                        ? '1.5px solid var(--primary)'
                        : tokenFocused
                        ? '1px solid rgba(10,132,255,0.5)'
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
                    {showToken ? '🙈 ' + tc('hide') : '👁️ ' + tc('show')}
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

              {/* ── Action buttons ── */}
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
              </div>
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
      `}</style>
    </>
  );
};
