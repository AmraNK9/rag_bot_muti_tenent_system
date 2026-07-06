import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Bot, BellRing, Send, CreditCard, Pencil, Eye, CheckCircle2, Zap } from 'lucide-react';
import { useChatbot } from '../../../contexts/ChatbotContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { updateChatbot, getSystemPrompt, updateSystemPrompt, getSystemBotInfo } from '../../../api/client';
import { BillingTab } from '../billing/BillingTab';

interface SettingsScreenProps {
  onClose: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onClose }) => {
  const { chatbot, credits, businessPlanInfo, setChatbot, loadProfileData } = useChatbot();
  const { profile } = useAuth();
  const { showToast } = useToast();
  const { t: tc } = useTranslation('common');
  const { t: tp } = useTranslation('prompt');

  // Bot Config State
  const [showEditBot, setShowEditBot] = useState(false);
  const [editName, setEditName] = useState(chatbot?.name || '');
  const [editDesc, setEditDesc] = useState(chatbot?.description || '');
  const [editToken, setEditToken] = useState('');
  const [editTimeout, setEditTimeout] = useState(chatbot?.handover_timeout_mins || 30);
  const [editLanguage, setEditLanguage] = useState(chatbot?.default_language || 'Myanmar');
  const [savingBot, setSavingBot] = useState(false);

  // Prompt State
  const [prompt, setPrompt] = useState('');
  const [activePrompt, setActivePrompt] = useState('');
  const [loadingPrompt, setLoadingPrompt] = useState(false);
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [editPromptMode, setEditPromptMode] = useState(false);
  const [hasPromptChanges, setHasPromptChanges] = useState(false);

  // Billing View State
  const [showBilling, setShowBilling] = useState(false);

  const [systemBotUsername, setSystemBotUsername] = useState('YourBotUsername');
  const isTelegramConnected = businessPlanInfo?.telegram_chat_id != null;
  // botUsername variable removed

  useEffect(() => {
    getSystemBotInfo()
      .then((res) => {
        if (res.success && res.username) {
          setSystemBotUsername(res.username);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (chatbot && !showBilling) {
      loadPrompt();
    }
  }, [chatbot, showBilling]);

  const loadPrompt = async () => {
    setLoadingPrompt(true);
    try {
      const data = await getSystemPrompt();
      console.log('[SystemPrompt] loaded:', data);
      setPrompt(data.customSystemPrompt || '');
      setActivePrompt(data.activePrompt || '');
    } catch (e) { console.error(e); }
    finally { setLoadingPrompt(false); }
  };

  const handleSaveBot = async () => {
    if (!chatbot || !editName.trim()) return;
    setSavingBot(true);
    try {
      const updated = await updateChatbot(
        editName.trim(),
        editDesc.trim(),
        editToken.trim() || undefined,
        editTimeout,
        editLanguage
      );
      setChatbot(updated);
      setShowEditBot(false);
      setEditToken('');
      showToast('success', 'Bot updated', 'Your bot configuration has been saved.');
    } catch (err: any) {
      showToast('error', tc('error.saveFailed'), err?.response?.data?.error || tc('tryAgain'));
    } finally {
      setSavingBot(false);
    }
  };

  const handleSavePrompt = async () => {
    setSavingPrompt(true);
    try {
      const data = await updateSystemPrompt(prompt);
      if (data) {
        setHasPromptChanges(false);
        setEditPromptMode(false);
        showToast('success', tp('toast.savedTitle'), tp('toast.savedMsg'));
        loadProfileData();
      }
    } catch (e: any) {
      showToast('error', tp('toast.errorTitle'), e?.response?.data?.error || tc('error.saveFailed'));
    } finally {
      setSavingPrompt(false);
    }
  };

  if (showBilling) {
    return (
      <div style={{ position: 'absolute', inset: 0, zIndex: 1000, background: 'var(--bg-page)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ height: 'var(--nav-h)', display: 'flex', alignItems: 'center', padding: '0 16px', background: 'var(--bg-glass)', borderBottom: '1px solid var(--border)' }}>
          <button onClick={() => setShowBilling(false)} style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--primary)', fontWeight: 600, fontSize: '1rem', cursor: 'pointer' }}>
            <ChevronLeft size={20} /> {tc('settings.backToSettings')}
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <BillingTab />
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 1000, background: 'var(--bg-page)', display: 'flex', flexDirection: 'column', animation: 'fadeInUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}>
      {/* Header */}
      <div style={{ height: 'var(--nav-h)', display: 'flex', alignItems: 'center', padding: '0 16px', background: 'var(--bg-glass)', backdropFilter: 'blur(20px)', borderBottom: '1px solid var(--border)', flexShrink: 0, zIndex: 2 }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--primary)', fontWeight: 600, fontSize: '1rem', cursor: 'pointer' }}>
          <ChevronLeft size={20} /> {tc('settings.back')}
        </button>
        <div style={{ flex: 1, textAlign: 'center', fontWeight: 700, fontSize: '1.05rem', paddingRight: 60 }}>
          {tc('settings.title')}
        </div>
      </div>

      {!profile?.isStandalone && (
        <div style={{ padding: '8px 16px', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          Managed by Business: <strong style={{ color: 'var(--text-main)', marginLeft: 4 }}>{businessPlanInfo?.name || 'Unknown'}</strong>
        </div>
      )}

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 16px 60px' }}>
        
        {/* 1. Bot Profile Section */}
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Bot size={20} color="var(--primary)" /> {tc('settings.botProfile')}
          </h2>
          <div style={{ background: 'var(--bg-surface-2)', borderRadius: 'var(--radius)', padding: 16, border: '1px solid var(--border)' }}>
            {!showEditBot ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{tc('settings.botName')}</div>
                    <div style={{ fontWeight: 600 }}>{chatbot?.name || 'Unnamed Bot'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>Language</div>
                    <div style={{ fontWeight: 600 }}>{chatbot?.default_language || 'Myanmar'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'right' }}>Role</div>
                    <div style={{ fontWeight: 600, textTransform: 'capitalize' }}>{chatbot?.bot_role || '-'}</div>
                  </div>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{tc('settings.description')}</div>
                <div style={{ marginBottom: 16 }}>{chatbot?.description || <span style={{ color: 'var(--text-muted)' }}>{tc('settings.noDescription')}</span>}</div>
                {profile?.isStandalone && (
                  <button className="btn btn-secondary btn-sm" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} onClick={() => setShowEditBot(true)}>
                    <Pencil size={14} /> {tc('settings.editBotDetails')}
                  </button>
                )}
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>{tc('settings.botName')}</label>
                  <input type="text" value={editName} onChange={e => setEditName(e.target.value)} placeholder="Bot name..." />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>{tc('settings.description')}</label>
                  <textarea rows={2} value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Optional description..." style={{ resize: 'none' }} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>{tc('settings.botToken')}</label>
                  <input type="password" value={editToken} onChange={e => setEditToken(e.target.value)} placeholder="Leave blank to keep existing..." />
                  <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: 4, display: 'block' }}>{tc('settings.botTokenHint')}</small>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Default Language</label>
                  <select 
                    value={editLanguage} 
                    onChange={e => setEditLanguage(e.target.value)}
                    className="chat-input-field" 
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-page)', border: '1px solid var(--border)', color: 'var(--text-main)', marginTop: '4px' }}
                  >
                    <option value="Myanmar">Myanmar</option>
                    <option value="English">English</option>
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>AI Auto-Release Timeout</label>
                  <select 
                    value={editTimeout} 
                    onChange={e => setEditTimeout(Number(e.target.value))}
                    className="chat-input-field" 
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-page)', border: '1px solid var(--border)', color: 'var(--text-main)', marginTop: '4px' }}
                  >
                    <option value={5}>5 minutes</option>
                    <option value={10}>10 minutes</option>
                    <option value={20}>20 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={60}>60 minutes</option>
                  </select>
                  <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: 4, display: 'block' }}>
                    Time before AI automatically takes back control if admin is inactive.
                  </small>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => setShowEditBot(false)} disabled={savingBot}>{tc('cancel')}</button>
                  <button className="btn btn-primary btn-sm" onClick={handleSaveBot} disabled={savingBot} style={{ flex: 1 }}>{savingBot ? tc('saving') : tc('settings.saveChanges')}</button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* 2. System Prompt Section */}
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Pencil size={20} color="var(--primary)" /> {tc('settings.systemPrompt')}
          </h2>
          <div style={{ background: 'var(--bg-surface-2)', borderRadius: 'var(--radius)', padding: 16, border: '1px solid var(--border)' }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 16 }}>
              {tp('subtitle')}
            </p>
            {profile?.canManageSystemPrompt && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <button className={`btn ${editPromptMode ? 'btn-primary' : 'btn-secondary'} btn-sm`} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={() => setEditPromptMode(true)}>
                  <Pencil size={14} /> {tp('editMode')}
                </button>
                <button className={`btn ${!editPromptMode ? 'btn-primary' : 'btn-secondary'} btn-sm`} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={() => setEditPromptMode(false)}>
                  <Eye size={14} /> {tp('previewMode')}
                </button>
              </div>
            )}

            {/* Prompt type badge */}
            {!editPromptMode && (
              <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                {prompt ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 6, background: 'rgba(10,132,255,0.12)', color: 'var(--primary)', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.5px' }}>
                    {tc('settings.customBadge')}
                  </span>
                ) : (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 6, background: 'rgba(142,142,147,0.15)', color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.5px' }}>
                    {tc('settings.defaultBadge')}
                  </span>
                )}
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  {prompt ? tc('settings.customPromptLabel') : tc('settings.activePromptLabel')}
                </span>
              </div>
            )}

            {editPromptMode ? (
              <textarea
                className="prompt-textarea"
                style={{ height: '180px', fontSize: '0.9rem', lineHeight: '1.6', width: '100%', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-page)', color: 'var(--text-main)', padding: 12 }}
                value={prompt}
                onChange={e => { setPrompt(e.target.value); setHasPromptChanges(true); }}
                placeholder={tp('promptPlaceholder')}
                disabled={loadingPrompt || savingPrompt}
              />
            ) : (
              <div style={{ height: '180px', overflowY: 'auto', background: 'var(--bg-page)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>
                {loadingPrompt ? tc('loading') : (prompt || activePrompt) || <span style={{ color: 'var(--text-muted)' }}>{tp('noPrompt')}</span>}
              </div>
            )}

            {editPromptMode && (
              <button className="btn btn-primary btn-sm" onClick={handleSavePrompt} disabled={savingPrompt || !hasPromptChanges} style={{ width: '100%', marginTop: 12 }}>
                {savingPrompt ? tc('saving') : tp('savePrompt')}
              </button>
            )}
          </div>
        </section>

        {/* 3. Telegram Notifications Section */}
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <BellRing size={20} color="var(--primary)" /> {tc('settings.telegramAlerts')}
          </h2>
          <div style={{ background: 'var(--bg-surface-2)', borderRadius: 'var(--radius)', padding: 16, border: '1px solid var(--border)' }}>
            {!isTelegramConnected && (
              <div style={{ background: 'rgba(10, 132, 255, 0.1)', padding: 12, borderRadius: 'var(--radius-sm)', marginBottom: 16, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <BellRing size={24} color="var(--primary)" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <h4 style={{ margin: '0 0 4px', fontSize: '0.9rem', color: 'var(--primary)' }}>{tc('settings.telegramNudgeTitle')}</h4>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-main)', lineHeight: 1.4 }}>
                    {tc('settings.telegramNudgeDesc')}
                  </p>
                </div>
              </div>
            )}
            
            <div style={{
              padding: '12px',
              borderRadius: 'var(--radius-sm)',
              background: isTelegramConnected ? 'rgba(50, 215, 75, 0.1)' : 'var(--bg-page)',
              border: isTelegramConnected ? '1px solid rgba(50, 215, 75, 0.3)' : '1px solid var(--border)',
              marginBottom: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: isTelegramConnected ? 'var(--green)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                {isTelegramConnected ? <><CheckCircle2 size={16} /> {tc('settings.telegramConnected')}</> : tc('settings.telegramNotConnected')}
              </span>
              {isTelegramConnected && businessPlanInfo?.telegram_username && (
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  @{businessPlanInfo.telegram_username}
                </span>
              )}
            </div>

            {businessPlanInfo?.id && (
              <a
                href={`https://t.me/${systemBotUsername}?start=connect_business_${businessPlanInfo.id}`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-primary"
                style={{ width: '100%', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                <Send size={18} /> {isTelegramConnected ? tc('settings.reconnectTelegram') : tc('settings.connectTelegram')}
              </a>
            )}
          </div>
        </section>

        {/* 4. Billing & Subscriptions */}
        {profile?.isStandalone && (
          <section style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <CreditCard size={20} color="var(--primary)" /> {tc('settings.billingTitle')}
            </h2>
            <div style={{ background: 'var(--bg-surface-2)', borderRadius: 'var(--radius)', padding: 16, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{tc('settings.currentPlan')}</div>
                  <div style={{ fontWeight: 600, fontSize: '1.1rem', textTransform: 'capitalize' }}>{businessPlanInfo?.plan_name || tc('settings.freePlan')}</div>
                  {businessPlanInfo?.subscriptionEndDate ? (
                    <div style={{ fontSize: '0.72rem', color: 'var(--orange)', marginTop: 2 }}>
                      {tc('settings.expires', { date: new Date(businessPlanInfo.subscriptionEndDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) })}
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>{tc('settings.noExpiry')}</div>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{tc('settings.availableCredits')}</div>
                  <div style={{ fontWeight: 700, fontSize: '1.2rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                    <Zap size={16} fill="currentColor" /> {credits || 0}
                  </div>
                  {businessPlanInfo?.plan_query_limit && (
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {tc('settings.creditsOf', { current: credits, total: businessPlanInfo.plan_query_limit })}
                    </div>
                  )}
                </div>
              </div>
              <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => setShowBilling(true)}>
                {tc('settings.manageBilling')}
              </button>
            </div>
          </section>
        )}

        {/* Legal Footer */}
        <footer style={{ textAlign: 'center', padding: '20px 0', borderTop: '1px solid var(--border-light)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8 }}>
            <a href="#" style={{ color: 'inherit', textDecoration: 'none' }}>Privacy Policy</a>
            <span>•</span>
            <a href="#" style={{ color: 'inherit', textDecoration: 'none' }}>Terms of Service</a>
            <span>•</span>
            <a href="#" style={{ color: 'inherit', textDecoration: 'none' }}>About Us</a>
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', opacity: 0.6 }}>
            Chatbot Admin v1.0.0
          </div>
        </footer>

      </div>
    </div>
  );
};
