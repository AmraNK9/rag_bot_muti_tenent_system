import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  login as apiLogin,
  registerStandalone as apiRegister,
  getProfile,
  updateChatbot,
  getConversations,
  getMessages,
  replyToConversation,
  getKnowledgeChunks,
  ingestDocument,
  deleteChunk,
  updateChunk,
  getSystemPrompt,
  updateSystemPrompt,
  createChatbot,
  getPaymentMethods,
  submitUpgrade,
} from './api/client';

interface AdminProfile {
  id: number;
  name: string;
  email: string;
  isStandalone: boolean;
  canManageKnowledge: boolean;
  canManageSystemPrompt: boolean;
}

interface ChatbotDetails {
  id: number;
  name: string;
  description: string | null;
  type: string;
  bot_role: string;
  custom_system_prompt: string | null;
}

interface Conversation {
  sender_id: string;
  message_count: string;
  last_message_at: string;
}

interface Message {
  id: number;
  sender_id: string;
  message: string;
  sender_type: 'user' | 'bot';
  sent_date: string;
}

interface KnowledgeChunk {
  id: string;
  text: string;
  metadata?: { chatbot_id?: number | string; source?: string };
}

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('chatbot_admin_token'));
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [chatbot, setChatbot] = useState<ChatbotDetails | null>(null);
  const [credits, setCredits] = useState<number>(0);
  const [loadingProfile, setLoadingProfile] = useState(false);

  const [isLoginTab, setIsLoginTab] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [authError, setAuthError] = useState('');
  const [submittingAuth, setSubmittingAuth] = useState(false);

  const [activeTab, setActiveTab] = useState<'chats' | 'knowledge' | 'prompt' | 'profile'>('chats');

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingConvs, setLoadingConvs] = useState(false);

  const [activeChatSender, setActiveChatSender] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [chunks, setChunks] = useState<KnowledgeChunk[]>([]);
  const [loadingChunks, setLoadingChunks] = useState(false);
  const [ingestText, setIngestText] = useState('');
  const [ingesting, setIngesting] = useState(false);

  const [systemPrompt, setSystemPrompt] = useState('');
  const [activePrompt, setActivePrompt] = useState('');
  const [loadingPrompt, setLoadingPrompt] = useState(false);
  const [updatingPrompt, setUpdatingPrompt] = useState(false);

  const [editBotName, setEditBotName] = useState('');
  const [editBotDesc, setEditBotDesc] = useState('');
  const [updatingBot, setUpdatingBot] = useState(false);

  const [newBotName, setNewBotName] = useState('');
  const [newBotToken, setNewBotToken] = useState('');
  const [newBotType, setNewBotType] = useState<'telegram' | 'facebook'>('telegram');
  const [newBotRole, setNewBotRole] = useState<'sales' | 'faq' | 'support' | 'custom'>('sales');
  const [creatingBot, setCreatingBot] = useState(false);
  const [createBotError, setCreateBotError] = useState('');

  const [editingChunk, setEditingChunk] = useState<KnowledgeChunk | null>(null);
  const [editText, setEditText] = useState('');
  const [updatingChunk, setUpdatingChunk] = useState(false);
  const [editError, setEditError] = useState('');

  const [referralCode, setReferralCode] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<'lite' | 'basic' | 'pro' | null>(null);
  const [kpayDetails, setKpayDetails] = useState<{ resellerId: number | null; kpay_no: string; kpay_name: string; note?: string } | null>(null);
  const [loadingKpay, setLoadingKpay] = useState(false);
  const [receiptBase64, setReceiptBase64] = useState<string | null>(null);
  const [receiptFilename, setReceiptFilename] = useState('');
  const [submittingUpgrade, setSubmittingUpgrade] = useState(false);
  const [upgradeMsg, setUpgradeMsg] = useState('');
  const [businessPlanInfo, setBusinessPlanInfo] = useState<any>(null);

  // Onboarding Landing & Tour states
  const [landingCompleted, setLandingCompleted] = useState<boolean>(() => localStorage.getItem('chatbot_admin_landing_completed') === 'true');
  const [landingStep, setLandingStep] = useState(1);
  const [showInAppTour, setShowInAppTour] = useState(false);
  const [inAppTourStep, setInAppTourStep] = useState(1);
  const [showCreateBotModal, setShowCreateBotModal] = useState(false);
  const [showTokenHelpModal, setShowTokenHelpModal] = useState(false);
  const [tokenHelpTab, setTokenHelpTab] = useState(1);

  const fetchProfile = useCallback(async () => {
    setLoadingProfile(true);
    try {
      const data = await getProfile();
      if (data.success) {
        setProfile(data.admin);
        setChatbot(data.chatbot);
        setCredits(data.credits);
        setBusinessPlanInfo(data.business);
        if (data.chatbot) {
          setEditBotName(data.chatbot.name);
          setEditBotDesc(data.chatbot.description || '');
          
          // In-App Tour check
          const inAppTourDone = localStorage.getItem('chatbot_admin_intro_completed');
          if (!inAppTourDone) {
            setShowInAppTour(true);
          }
        }
      }
    } catch (e) {
      console.error(e);
      handleLogout();
    } finally {
      setLoadingProfile(false);
    }
  }, []);

  useEffect(() => {
    if (token) fetchProfile();
  }, [token, fetchProfile]);

  useEffect(() => {
    if (!token) return;
    if (activeTab === 'chats') loadConversations();
    else if (activeTab === 'knowledge' && profile?.canManageKnowledge) loadKnowledge();
    else if (activeTab === 'prompt' && profile?.canManageSystemPrompt) loadSystemPrompt();
  }, [activeTab, token, profile]);

  const loadConversations = async () => {
    setLoadingConvs(true);
    try {
      const data = await getConversations();
      setConversations(data.conversations || []);
    } catch (e) { console.error(e); }
    finally { setLoadingConvs(false); }
  };

  const loadMessagesForSender = async (senderId: string) => {
    setLoadingMsgs(true);
    try {
      const data = await getMessages(senderId, 100, 0);
      setMessages(data.messages || []);
      setTimeout(scrollToBottom, 80);
    } catch (e) { console.error(e); }
    finally { setLoadingMsgs(false); }
  };

  useEffect(() => {
    if (!activeChatSender) return;
    const interval = setInterval(() => {
      getMessages(activeChatSender, 100, 0).then((data) => {
        if (data.messages && data.messages.length !== messages.length) {
          setMessages(data.messages);
          scrollToBottom();
        }
      }).catch(console.error);
    }, 4000);
    return () => clearInterval(interval);
  }, [activeChatSender, messages.length]);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  const loadKnowledge = async () => {
    setLoadingChunks(true);
    try {
      const data = await getKnowledgeChunks(100, 0);
      setChunks(data.chunks || []);
    } catch (e) { console.error(e); }
    finally { setLoadingChunks(false); }
  };

  const loadSystemPrompt = async () => {
    setLoadingPrompt(true);
    try {
      const data = await getSystemPrompt();
      setSystemPrompt(data.customSystemPrompt || '');
      setActivePrompt(data.activePrompt || '');
    } catch (e) { console.error(e); }
    finally { setLoadingPrompt(false); }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setSubmittingAuth(true);
    try {
      const data = await apiLogin(email, password);
      if (data.success && data.token) {
        localStorage.setItem('chatbot_admin_token', data.token);
        setToken(data.token);
        setEmail(''); setPassword('');
      }
    } catch (err: any) {
      setAuthError(err.response?.data?.error || 'Invalid credentials');
    } finally { setSubmittingAuth(false); }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setSubmittingAuth(true);
    try {
      const data = await apiRegister({ name, email, password, referralCode: referralCode || undefined });
      if (data.success && data.token) {
        localStorage.setItem('chatbot_admin_token', data.token);
        setToken(data.token);
        setName(''); setEmail(''); setPassword(''); setReferralCode('');
      }
    } catch (err: any) {
      setAuthError(err.response?.data?.error || 'Registration failed');
    } finally { setSubmittingAuth(false); }
  };

  const handleCreateChatbot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBotName || !newBotToken) return;
    setCreatingBot(true);
    setCreateBotError('');
    try {
      const data = await createChatbot(newBotName, newBotToken, newBotType, newBotRole);
      if (data.success) {
        localStorage.setItem('chatbot_admin_token', data.token);
        setToken(data.token);
        setChatbot(data.chatbot);
        setNewBotName(''); setNewBotToken('');
        fetchProfile();
        setShowCreateBotModal(false);
      }
    } catch (err: any) {
      setCreateBotError(err.response?.data?.error || 'Failed to create chatbot');
    } finally { setCreatingBot(false); }
  };

  const handleSelectPlan = async (plan: 'lite' | 'basic' | 'pro') => {
    setSelectedPlan(plan);
    setLoadingKpay(true);
    setUpgradeMsg('');
    setReceiptBase64(null);
    setReceiptFilename('');
    try {
      const data = await getPaymentMethods(plan);
      if (data.success) setKpayDetails(data);
    } catch (e) {
      console.error(e);
      alert('Failed to load payment details.');
    } finally { setLoadingKpay(false); }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReceiptFilename(file.name);
    const reader = new FileReader();
    reader.onloadend = () => setReceiptBase64(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmitUpgrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan || !receiptBase64 || !kpayDetails) return;
    setSubmittingUpgrade(true);
    setUpgradeMsg('');
    try {
      const data = await submitUpgrade(selectedPlan, receiptBase64, kpayDetails.resellerId);
      if (data.success) {
        setUpgradeMsg('✅ Upgrade request submitted! Waiting for verification.');
        setTimeout(() => {
          setSelectedPlan(null); setKpayDetails(null);
          setReceiptBase64(null); setReceiptFilename('');
          fetchProfile();
        }, 2500);
      }
    } catch (err: any) {
      setUpgradeMsg(`❌ ${err.response?.data?.error || 'Upgrade failed'}`);
    } finally { setSubmittingUpgrade(false); }
  };

  const handleUpdateChunk = async () => {
    if (!editingChunk || !editText.trim()) return;
    setUpdatingChunk(true);
    setEditError('');
    try {
      const data = await updateChunk(editingChunk.id, editText.trim());
      if (data.success) {
        alert('Chunk updated successfully');
        setEditingChunk(null);
        loadKnowledge();
      }
    } catch (err: any) {
      setEditError(err.response?.data?.error || 'Failed to update chunk');
    } finally { setUpdatingChunk(false); }
  };

  const handleLogout = () => {
    localStorage.removeItem('chatbot_admin_token');
    localStorage.removeItem('chatbot_admin_profile');
    setToken(null); setProfile(null); setChatbot(null);
    setActiveChatSender(null); setMessages([]);
    setLandingStep(1);
    setInAppTourStep(1);
    setShowInAppTour(false);
    setShowCreateBotModal(false);
    setShowTokenHelpModal(false);
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !activeChatSender || sendingReply) return;
    setSendingReply(true);
    try {
      const data = await replyToConversation(activeChatSender, replyText.trim());
      if (data.success && data.message) {
        setMessages((prev) => [...prev, data.message]);
        setReplyText('');
        setCredits((prev) => Math.max(0, prev - 1));
        setTimeout(scrollToBottom, 50);
      }
    } catch (e) {
      console.error(e);
      alert('Failed to send reply');
    } finally { setSendingReply(false); }
  };

  const handleIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ingestText.trim() || ingesting) return;
    setIngesting(true);
    try {
      const result = await ingestDocument(ingestText.trim());
      if (result.success) {
        setIngestText('');
        alert(`Successfully ingested: ${result.chunksAdded} chunks added.`);
        loadKnowledge();
      }
    } catch (e: any) {
      alert(e.response?.data?.error || 'Ingest failed');
    } finally { setIngesting(false); }
  };

  const handleDeleteChunk = async (docId: string) => {
    if (!confirm('Delete this knowledge chunk?')) return;
    try {
      await deleteChunk(docId);
      setChunks((prev) => prev.filter((c) => c.id !== docId));
    } catch (e) { alert('Failed to delete chunk'); }
  };

  const handleUpdatePrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdatingPrompt(true);
    try {
      const result = await updateSystemPrompt(systemPrompt);
      if (result.success) alert('System prompt updated successfully');
    } catch (e: any) {
      alert(e.response?.data?.error || 'Update failed');
    } finally { setUpdatingPrompt(false); }
  };

  const handleUpdateBotMetadata = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatbot || updatingBot) return;
    setUpdatingBot(true);
    try {
      const result = await updateChatbot(editBotName, editBotDesc);
      if (result.success) { setChatbot(result.chatbot); alert('Chatbot details updated successfully'); }
    } catch (e) { alert('Failed to update chatbot'); }
    finally { setUpdatingBot(false); }
  };

  const getInitials = (str: string) => str ? str.slice(-2).toUpperCase() : 'U';

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  };

  // ─── LANDING PAGE VIEW ───────────────────────────────────────────────────
  if (!landingCompleted) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', minHeight: '100vh',
        background: 'linear-gradient(180deg, var(--bg-header) 0%, var(--bg-page) 100%)',
        color: 'var(--text-main)', padding: '0 24px', alignItems: 'center', justifyContent: 'center'
      }}>
        <div style={{ width: '100%', maxWidth: '640px', textAlign: 'center' }}>
          
          <div style={{
            width: '64px', height: '64px', borderRadius: '18px',
            background: 'linear-gradient(135deg, #1f6feb 0%, #0d5bce 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.8rem', margin: '0 auto 40px',
            boxShadow: '0 8px 24px rgba(31,111,235,0.3)'
          }}>🤖</div>

          {landingStep === 1 && (
            <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
              <div style={{ fontSize: '4rem', marginBottom: '24px' }}>🧠</div>
              <h2 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '16px', letterSpacing: '-0.5px' }}>
                Knowledge-Aware AI Chatbot
              </h2>
              <p style={{ fontSize: '1.05rem', color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: '480px', margin: '0 auto' }}>
                သင့်လုပ်ငန်းဆိုင်ရာ အချက်အလက်များကို AI အား လွယ်ကူစွာ သင်ကြားပေးပြီး Customer များ၏ မေးခွန်းများကို တိကျမှန်ကန်စွာ ၂၄ နာရီ အလိုအလျောက် ဖြေကြားပေးနိုင်ပါသည်။
              </p>
            </div>
          )}

          {landingStep === 2 && (
            <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
              <div style={{ fontSize: '4rem', marginBottom: '24px' }}>✨</div>
              <h2 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '16px', letterSpacing: '-0.5px' }}>
                လွယ်ကူရိုးရှင်းသော အသုံးပြုမှု
              </h2>
              <p style={{ fontSize: '1.05rem', color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: '480px', margin: '0 auto' }}>
                Coding ရေးရန် လုံးဝမလိုပါ။ ၅ မိနစ်အတွင်း သင့်ကိုယ်ပိုင် AI Chatbot တစ်ခုကို လွယ်ကူလျင်မြန်စွာ ဖန်တီးချိတ်ဆက် အသုံးပြုနိုင်ပါသည်။
              </p>
            </div>
          )}

          {landingStep === 3 && (
            <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
              <div style={{ fontSize: '4rem', marginBottom: '24px' }}>💎</div>
              <h2 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '16px', letterSpacing: '-0.5px' }}>
                သက်သာသော ဈေးနှုန်း
              </h2>
              <p style={{ fontSize: '1.05rem', color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: '480px', margin: '0 auto' }}>
                အသေးစား၊ အလတ်စား လုပ်ငန်းများအတွက် ရည်ရွယ်ပြီး သက်သာသော ဈေးနှုန်းဖြင့် မိမိနှစ်သက်ရာ Plan ကို ရွေးချယ်အသုံးပြုနိုင်ပါသည်။
              </p>
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '48px', marginBottom: '40px' }}>
            {[1, 2, 3].map((step) => (
              <div
                key={step}
                style={{
                  width: landingStep === step ? '32px' : '10px',
                  height: '10px',
                  borderRadius: '5px',
                  backgroundColor: landingStep === step ? 'var(--blue)' : 'var(--border)',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer'
                }}
                onClick={() => setLandingStep(step)}
              />
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', maxWidth: '320px', margin: '0 auto' }}>
            {landingStep < 3 ? (
              <button className="btn btn-primary" style={{ width: '100%', minHeight: '54px', fontSize: '1.1rem', borderRadius: '27px' }} onClick={() => setLandingStep((prev) => prev + 1)}>
                Next
              </button>
            ) : (
              <button className="btn btn-primary" style={{ width: '100%', minHeight: '54px', fontSize: '1.1rem', borderRadius: '27px', background: 'var(--green)' }} onClick={() => { localStorage.setItem('chatbot_admin_landing_completed', 'true'); setLandingCompleted(true); }}>
                Get Started 🚀
              </button>
            )}
          </div>

        </div>
      </div>
    );
  }

  // ─── AUTHENTICATION VIEW ─────────────────────────────────────────────────
  if (!token) {
    return (
      <div className="auth-wrapper">
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '16px',
            background: 'linear-gradient(135deg, #1f6feb 0%, #0d5bce 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.5rem', margin: '0 auto 14px',
            boxShadow: '0 4px 20px rgba(31,111,235,0.3)'
          }}>🤖</div>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 700, letterSpacing: '-0.3px', marginBottom: '6px' }}>
            Chatbot Admin
          </h1>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
            ၅ မိနစ်အတွင်း စာပြန်မြန်ဆန်သော AI Chatbot တစ်ခု တည်ဆောက်လိုက်ပါ
          </p>

          {/* Landing Mini Props Card Removed */}
        </div>

        <div className="auth-card">
          <div className="auth-tabs">
            <button className={`auth-tab ${isLoginTab ? 'active' : ''}`} onClick={() => { setIsLoginTab(true); setAuthError(''); }}>
              Sign In
            </button>
            <button className={`auth-tab ${!isLoginTab ? 'active' : ''}`} onClick={() => { setIsLoginTab(false); setAuthError(''); }}>
              Register
            </button>
          </div>

          {authError && (
            <div className="alert-box alert-error">⚠️ {authError}</div>
          )}

          {isLoginTab ? (
            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label>Email</label>
                <input className="form-control" type="email" required placeholder="name@domain.com"
                  value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input className="form-control" type="password" required placeholder="••••••••"
                  value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <button className="btn btn-primary" style={{ marginTop: '8px' }} type="submit" disabled={submittingAuth}>
                {submittingAuth ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister}>
              <div className="form-group">
                <label>Your Name</label>
                <input className="form-control" type="text" required placeholder="John Doe"
                  value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input className="form-control" type="email" required placeholder="john@company.com"
                  value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input className="form-control" type="password" required placeholder="Minimum 6 characters"
                  value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Referral Code <span style={{ fontWeight: 400, textTransform: 'none', fontSize: '0.72rem' }}>(optional)</span></label>
                <input className="form-control" type="text" placeholder="e.g. 1002"
                  value={referralCode} onChange={(e) => setReferralCode(e.target.value)} />
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '12px 0', lineHeight: 1.5 }}>
                Registering lets you create chatbots, customize prompts, upload knowledge bases, and subscribe to premium plans.
              </p>
              <button className="btn btn-primary" type="submit" disabled={submittingAuth}>
                {submittingAuth ? 'Creating Account...' : 'Create Account'}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }



  // ─── MAIN PLATFORM LAYOUT ────────────────────────────────────────────────
  return (
    <div className="app-container">
      {/* HEADER */}
      <header className="app-header">
        <div>
          <h2>{chatbot?.name || '...'}</h2>
          <div className="app-header-subtitle">
            {profile?.isStandalone ? 'Standalone' : 'Business'} · {credits} credits
          </div>
        </div>
        <button
          className="btn btn-ghost"
          style={{ width: 'auto', padding: '6px 12px', fontSize: '0.8rem', minHeight: '34px' }}
          onClick={handleLogout}
        >
          Sign out
        </button>
      </header>

      {/* CONTENT */}
      <main className="app-content">
        {loadingProfile ? (
          <div className="loading-container">
            <div className="spinner" />
            <p>Loading...</p>
          </div>
        ) : (
          <>
            {/* CHATS TAB */}
            {activeTab === 'chats' && (
              <div>
                {!chatbot ? (
                  <div className="empty-state" style={{ padding: '40px 20px', textAlign: 'center' }}>
                    <div className="empty-icon" style={{ fontSize: '3rem', marginBottom: '16px' }}>🔌</div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '8px' }}>
                      Connect Your First AI Chatbot
                    </h3>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.5, maxWidth: '280px', margin: '0 auto 20px' }}>
                      လွယ်ကူလျင်မြန်စွာ ချိတ်ဆက်ပြီး သုံးစွဲသူများအား AI ဖြင့် အလိုအလျောက် အဖြေပေးနိုင်ရန် စတင်လိုက်ပါ။
                    </p>
                    <button className="btn btn-primary" onClick={() => setShowCreateBotModal(true)}>
                      ➕ Create Your First AI Bot
                    </button>
                  </div>
                ) : loadingConvs ? (
                  <div className="loading-container">
                    <div className="spinner" />
                    <p>Loading conversations...</p>
                  </div>
                ) : conversations.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">💬</div>
                    <p>No conversations yet.</p>
                    <p style={{ fontSize: '0.75rem', marginTop: '4px' }}>Incoming chats will appear here.</p>
                  </div>
                ) : (
                  <div className="chat-list">
                    {conversations.map((conv) => (
                      <div
                        key={conv.sender_id}
                        className="chat-list-item"
                        onClick={() => { setActiveChatSender(conv.sender_id); loadMessagesForSender(conv.sender_id); }}
                      >
                        <div className="chat-list-avatar">{getInitials(conv.sender_id)}</div>
                        <div className="chat-list-details">
                          <div className="chat-list-meta">
                            <div className="chat-list-name">User {conv.sender_id}</div>
                            <div className="chat-list-time">{formatDate(conv.last_message_at)}</div>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div className="chat-list-preview">Tap to view thread</div>
                            <span className="chat-list-badge">{conv.message_count}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* KNOWLEDGE TAB */}
            {activeTab === 'knowledge' && (
              <div className="settings-list">
                {!profile?.canManageKnowledge ? (
                  <div className="settings-card">
                    <div className="empty-state" style={{ padding: '32px 16px' }}>
                      <div className="empty-icon">🔒</div>
                      <p style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>Permission Required</p>
                      <p style={{ fontSize: '0.8rem' }}>Your account does not have access to the Knowledge Base. Contact the Business Admin.</p>
                    </div>
                  </div>
                ) : !chatbot ? (
                  <div className="settings-card">
                    <div className="empty-state" style={{ padding: '32px 16px' }}>
                      <div className="empty-icon">🔌</div>
                      <p style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>Chatbot Connection Required</p>
                      <p style={{ fontSize: '0.8rem' }}>သင့်အကောင့်တွင် Chatbot ချိတ်ဆက်ထားခြင်း မရှိသေးပါ။ Knowledge Base အသုံးမပြုမီ Chatbot တစ်ခု အရင်ဖန်တီးပေးပါ။</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="settings-card">
                      <div className="settings-card-title">Add Knowledge</div>
                      <div className="settings-card-body">
                        <form onSubmit={handleIngest}>
                          <div className="form-group">
                            <label>Text Content</label>
                            <textarea
                              className="form-control"
                              style={{ height: '110px', resize: 'vertical' }}
                              required
                              placeholder="Enter text or knowledge base content to add..."
                              value={ingestText}
                              onChange={(e) => setIngestText(e.target.value)}
                            />
                          </div>
                          <button className="btn btn-primary" type="submit" disabled={ingesting || !ingestText.trim()}>
                            {ingesting ? 'Processing...' : 'Add to Knowledge Base'}
                          </button>
                        </form>
                      </div>
                    </div>

                    <div className="settings-card">
                      <div className="settings-card-title">
                        Document Chunks ({chunks.length})
                      </div>
                      {loadingChunks ? (
                        <div className="loading-container" style={{ padding: '24px' }}>
                          <div className="spinner" />
                        </div>
                      ) : chunks.length === 0 ? (
                        <div className="empty-state" style={{ padding: '24px' }}>
                          <p style={{ fontSize: '0.82rem' }}>Knowledge base is empty.</p>
                        </div>
                      ) : (
                        <div style={{ padding: '10px 12px' }}>
                          {chunks.map((chunk) => (
                            <div key={chunk.id} className="chunk-card">
                              <div className="chunk-card-meta">
                                <span>ID: {chunk.id.slice(0, 14)}…</span>
                                <div className="chunk-actions">
                                  <button className="chunk-btn chunk-btn-edit"
                                    onClick={() => { setEditingChunk(chunk); setEditText(chunk.text); setEditError(''); }}>
                                    Edit
                                  </button>
                                  <button className="chunk-btn chunk-btn-delete"
                                    onClick={() => handleDeleteChunk(chunk.id)}>
                                    Delete
                                  </button>
                                </div>
                              </div>
                              <div className="chunk-text">{chunk.text}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Edit Chunk Modal */}
                    {editingChunk && (
                      <div className="modal-backdrop" onClick={() => setEditingChunk(null)}>
                        <div className="tg-modal" onClick={(e) => e.stopPropagation()}>
                          <div className="tg-modal-header">
                            <h3>Edit Chunk</h3>
                            <button className="btn btn-ghost"
                              style={{ width: 'auto', padding: '4px 10px', fontSize: '0.8rem', minHeight: '30px' }}
                              onClick={() => setEditingChunk(null)}>
                              Cancel
                            </button>
                          </div>
                          <div className="tg-modal-body">
                            {editError && <div className="alert-box alert-error" style={{ marginBottom: '10px' }}>⚠️ {editError}</div>}
                            <textarea
                              className="form-control"
                              style={{ height: '140px', resize: 'vertical' }}
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                            />
                          </div>
                          <div className="tg-modal-footer">
                            <button className="btn btn-primary"
                              style={{ width: 'auto', padding: '8px 20px' }}
                              disabled={updatingChunk || !editText.trim()}
                              onClick={handleUpdateChunk}>
                              {updatingChunk ? 'Saving...' : 'Save Changes'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* PROMPT TAB */}
            {activeTab === 'prompt' && (
              <div className="settings-list">
                {!profile?.canManageSystemPrompt ? (
                  <div className="settings-card">
                    <div className="empty-state" style={{ padding: '32px 16px' }}>
                      <div className="empty-icon">🔒</div>
                      <p style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>Permission Required</p>
                      <p style={{ fontSize: '0.8rem' }}>Your account does not have access to modify the System Prompt.</p>
                    </div>
                  </div>
                ) : !chatbot ? (
                  <div className="settings-card">
                    <div className="empty-state" style={{ padding: '32px 16px' }}>
                      <div className="empty-icon">🔌</div>
                      <p style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>Chatbot Connection Required</p>
                      <p style={{ fontSize: '0.8rem' }}>သင့်အကောင့်တွင် Chatbot ချိတ်ဆက်ထားခြင်း မရှိသေးပါ။ System Prompt ပြင်ဆင်ရန် Chatbot တစ်ခု အရင်ဖန်တီးပေးပါ။</p>
                    </div>
                  </div>
                ) : (
                  <div className="settings-card">
                    <div className="settings-card-title">Custom System Prompt</div>
                    <div className="settings-card-body">
                      {loadingPrompt ? (
                        <div className="loading-container" style={{ padding: '24px' }}><div className="spinner" /></div>
                      ) : (
                        <form onSubmit={handleUpdatePrompt}>
                          <div className="form-group">
                            <label>Bot Persona & Instructions</label>
                            <textarea
                              className="form-control"
                              style={{ height: '180px', fontFamily: 'monospace', fontSize: '0.83rem', resize: 'vertical' }}
                              placeholder="Write custom instructions or leave empty to use the default role template..."
                              value={systemPrompt}
                              onChange={(e) => setSystemPrompt(e.target.value)}
                            />
                          </div>

                          {!systemPrompt && activePrompt && (
                            <div style={{
                              padding: '12px', background: 'rgba(255,255,255,0.03)',
                              border: '1px dashed var(--border-light)', borderRadius: '8px',
                              marginBottom: '14px'
                            }}>
                              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-link)', marginBottom: '6px' }}>
                                Active fallback: {chatbot?.bot_role?.toUpperCase() || 'SALES'} role
                              </div>
                              <div style={{ whiteSpace: 'pre-wrap', color: 'var(--text-muted)', maxHeight: '120px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '0.73rem', lineHeight: 1.4 }}>
                                {activePrompt}
                              </div>
                            </div>
                          )}

                          <button className="btn btn-primary" type="submit" disabled={updatingPrompt}>
                            {updatingPrompt ? 'Saving...' : 'Update System Prompt'}
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* PROFILE TAB */}
            {activeTab === 'profile' && (
              <div className="settings-list">
                {chatbot && profile?.isStandalone && (
                  <div className="settings-card">
                    <div className="settings-card-title">Bot Information</div>
                    <div className="settings-card-body">
                      <form onSubmit={handleUpdateBotMetadata}>
                        <div className="form-group">
                          <label>Bot Name</label>
                          <input className="form-control" type="text" required value={editBotName}
                            onChange={(e) => setEditBotName(e.target.value)} />
                        </div>
                        <div className="form-group">
                          <label>Description</label>
                          <textarea className="form-control" style={{ height: '72px', resize: 'vertical' }}
                            value={editBotDesc} onChange={(e) => setEditBotDesc(e.target.value)}
                            placeholder="What does this bot do?" />
                        </div>
                        <button className="btn btn-primary" type="submit" disabled={updatingBot}>
                          {updatingBot ? 'Saving...' : 'Save Bot Info'}
                        </button>
                      </form>
                    </div>
                  </div>
                )}

                <div className="settings-card">
                  <div className="settings-card-title">Account Details</div>
                  <div className="settings-row">
                    <div className="settings-label">Name</div>
                    <div className="settings-value">{profile?.name}</div>
                  </div>
                  <div className="settings-row">
                    <div className="settings-label">Email</div>
                    <div className="settings-value" style={{ fontSize: '0.8rem' }}>{profile?.email}</div>
                  </div>
                  <div className="settings-row">
                    <div className="settings-label">Account Type</div>
                    <div className="settings-value">
                      {profile?.isStandalone
                        ? <span className="badge badge-green">Standalone</span>
                        : <span className="badge badge-blue">Business</span>}
                    </div>
                  </div>
                  <div className="settings-row">
                    <div className="settings-label">Message Credits</div>
                    <div className="settings-value" style={{ fontWeight: 700, color: 'var(--text-link)' }}>
                      {credits}
                    </div>
                  </div>
                </div>

                {profile?.isStandalone && (
                  <div className="settings-card">
                    <div className="settings-card-title">Subscription & Upgrade</div>
                    <div className="settings-row">
                      <div className="settings-label">Active Plan</div>
                      <div className="settings-value" style={{ fontWeight: 600, color: 'var(--text-link)', textTransform: 'capitalize' }}>
                        {businessPlanInfo?.plan === 'subscription'
                          ? `${businessPlanInfo?.subscriptionPlan} Plan`
                          : 'Free (Prepaid)'}
                      </div>
                    </div>
                    {businessPlanInfo?.subscriptionEndDate && (
                      <div className="settings-row">
                        <div className="settings-label">Expires</div>
                        <div className="settings-value">
                          {new Date(businessPlanInfo.subscriptionEndDate).toLocaleDateString()}
                        </div>
                      </div>
                    )}

                    <div style={{ padding: '14px' }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '10px' }}>
                        Choose a plan:
                      </div>
                      <div className="plans-grid">
                        {(['lite', 'basic', 'pro'] as const).map((plan) => {
                          const prices = { lite: '3,000', basic: '15,000', pro: '30,000' };
                          const credits = { lite: '500', basic: '3,000', pro: '10,000' };
                          return (
                            <div
                              key={plan}
                              className={`plan-card-option ${selectedPlan === plan ? 'selected' : ''}`}
                              onClick={() => handleSelectPlan(plan)}
                            >
                              <div style={{ fontWeight: 700, fontSize: '0.85rem', textTransform: 'capitalize', marginBottom: '4px' }}>{plan}</div>
                              <div style={{ color: 'var(--text-link)', fontSize: '0.85rem', fontWeight: 700 }}>{prices[plan]}</div>
                              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '3px' }}>{credits[plan]} msgs</div>
                            </div>
                          );
                        })}
                      </div>

                      {selectedPlan && (
                        <div className="payment-checkout-box">
                          {loadingKpay ? (
                            <div className="loading-container" style={{ padding: '16px' }}><div className="spinner" /></div>
                          ) : (
                            <form onSubmit={handleSubmitUpgrade}>
                              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
                                KBZ Pay Transfer Details
                              </div>

                              <div className="settings-row" style={{ padding: '8px 0' }}>
                                <div className="settings-label" style={{ fontSize: '0.8rem' }}>KPay Phone</div>
                                <div className="settings-value" style={{ fontWeight: 700, color: 'var(--text-main)' }}>{kpayDetails?.kpay_no}</div>
                              </div>
                              <div className="settings-row" style={{ padding: '8px 0', borderBottom: 'none' }}>
                                <div className="settings-label" style={{ fontSize: '0.8rem' }}>Account Name</div>
                                <div className="settings-value" style={{ fontWeight: 700, color: 'var(--text-main)' }}>{kpayDetails?.kpay_name}</div>
                              </div>

                              <p style={{ fontSize: '0.73rem', color: 'var(--text-muted)', lineHeight: 1.5, margin: '10px 0 12px' }}>
                                Transfer the exact amount via KBZ Pay, then upload your transaction screenshot below.
                              </p>

                              <div className="form-group">
                                <label>Upload KPay Screenshot</label>
                                <div style={{ position: 'relative', overflow: 'hidden', display: 'inline-block', width: '100%' }}>
                                  <input type="file" accept="image/*" required onChange={handleFileChange}
                                    style={{ position: 'absolute', top: 0, left: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }} />
                                  <button className="btn btn-ghost" type="button"
                                    style={{ width: '100%', fontSize: '0.83rem', borderStyle: 'dashed' }}>
                                    {receiptFilename ? `📎 ${receiptFilename}` : '📁 Choose Screenshot'}
                                  </button>
                                </div>
                              </div>

                              {upgradeMsg && (
                                <div style={{
                                  padding: '8px 12px', borderRadius: '6px', fontSize: '0.8rem', margin: '10px 0',
                                  background: upgradeMsg.startsWith('✅') ? 'rgba(63,185,80,0.1)' : 'rgba(248,81,73,0.1)',
                                  color: upgradeMsg.startsWith('✅') ? 'var(--green)' : 'var(--red)',
                                  border: `1px solid ${upgradeMsg.startsWith('✅') ? 'rgba(63,185,80,0.2)' : 'rgba(248,81,73,0.2)'}`
                                }}>
                                  {upgradeMsg}
                                </div>
                              )}

                              <button className="btn btn-primary" style={{ marginTop: '10px' }} type="submit"
                                disabled={submittingUpgrade || !receiptBase64}>
                                {submittingUpgrade ? 'Submitting...' : 'Submit Upgrade Request'}
                              </button>
                            </form>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="settings-card">
                  <div className="settings-card-title">Permissions</div>
                  <div className="settings-row">
                    <div className="settings-label">Knowledge Base</div>
                    <div className="settings-value">
                      {profile?.canManageKnowledge
                        ? <span style={{ color: 'var(--green)', fontWeight: 600 }}>Allowed</span>
                        : <span style={{ color: 'var(--red)', fontWeight: 600 }}>Restricted</span>}
                    </div>
                  </div>
                  <div className="settings-row">
                    <div className="settings-label">System Prompt</div>
                    <div className="settings-value">
                      {profile?.canManageSystemPrompt
                        ? <span style={{ color: 'var(--green)', fontWeight: 600 }}>Allowed</span>
                        : <span style={{ color: 'var(--red)', fontWeight: 600 }}>Restricted</span>}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* BOTTOM NAVIGATION */}
      <nav className="bottom-nav">
        {([
          { key: 'chats', icon: '💬', label: 'Chats' },
          { key: 'knowledge', icon: '📚', label: 'Knowledge' },
          { key: 'prompt', icon: '⚙️', label: 'Prompt' },
          { key: 'profile', icon: '👤', label: 'Profile' },
        ] as const).map(({ key, icon, label }) => (
          <button
            key={key}
            className={`nav-item ${activeTab === key ? 'active' : ''}`}
            onClick={() => { setActiveTab(key); setActiveChatSender(null); }}
          >
            <span className="nav-icon">{icon}</span>
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {/* ACTIVE CHAT SCREEN OVERLAY */}
      {activeChatSender && (
        <div className="chat-window" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 150, maxWidth: '640px', margin: '0 auto' }}>
          <header className="app-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                className="btn btn-ghost"
                style={{ width: '36px', height: '36px', padding: '0', fontSize: '1rem', borderRadius: '50%', minHeight: '36px' }}
                onClick={() => setActiveChatSender(null)}
              >
                ←
              </button>
              <div>
                <h2 style={{ fontSize: '0.95rem' }}>User: {activeChatSender}</h2>
                <div className="app-header-subtitle">Live conversation</div>
              </div>
            </div>
          </header>

          <div className="chat-messages-container" id="chat-messages-panel">
            {loadingMsgs ? (
              <div className="loading-container">
                <div className="spinner" />
                <p>Loading messages...</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="empty-state">
                <p style={{ fontSize: '0.85rem' }}>No messages yet.</p>
              </div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className={`msg-wrapper ${msg.sender_type}`}>
                  <div className={`tg-bubble ${msg.sender_type}`}>
                    {msg.message}
                    <span className="tg-bubble-time">{formatTime(msg.sent_date)}</span>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="chat-input-bar">
            <textarea
              className="chat-input-field"
              placeholder="Write a reply..."
              rows={1}
              value={replyText}
              disabled={sendingReply}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendReply();
                }
              }}
            />
            <button
              className="chat-send-btn"
              onClick={handleSendReply}
              disabled={sendingReply || !replyText.trim() || credits <= 0}
            >
              {sendingReply ? '…' : '↑'}
            </button>
          </div>
        </div>
      )}

      {/* IN-APP ONBOARDING TOUR */}
      {showInAppTour && (
        <div className="modal-backdrop" style={{ zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="tg-modal" style={{ maxWidth: '380px', borderRadius: '14px', margin: '16px' }} onClick={(e) => e.stopPropagation()}>
            <div className="tg-modal-header" style={{ borderBottom: 'none' }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[1, 2, 3].map((step) => (
                  <div
                    key={step}
                    style={{
                      width: '24px',
                      height: '4px',
                      borderRadius: '2px',
                      backgroundColor: inAppTourStep === step ? 'var(--blue)' : 'var(--border)',
                      transition: 'background-color 0.2s',
                    }}
                  />
                ))}
              </div>
              <button
                className="btn btn-ghost"
                style={{ width: 'auto', border: 'none', background: 'none', color: 'var(--text-muted)', fontSize: '0.8rem', minHeight: 'auto', padding: '4px 8px' }}
                onClick={() => { localStorage.setItem('chatbot_admin_intro_completed', 'true'); setShowInAppTour(false); }}
              >
                Skip
              </button>
            </div>

            <div className="tg-modal-body" style={{ textAlign: 'center', padding: '10px 24px 24px' }}>
              {inAppTourStep === 1 && (
                <div style={{ animation: 'fadeIn 0.3s' }}>
                  <div style={{ width: '68px', height: '68px', borderRadius: '22px', background: 'rgba(31, 111, 235, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', margin: '0 auto 20px', color: 'var(--blue-hover)' }}>📚</div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '10px', color: 'var(--text-main)' }}>၁။ Knowledge Base (အသိပညာ ဖြည့်သွင်းခြင်း)</h3>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>သင်၏ လုပ်ငန်းဆိုင်ရာ အချက်အလက်များ၊ ဝန်ဆောင်မှု ဈေးနှုန်းများနှင့် အမေးများသောမေးခွန်း (FAQ) များကို <strong>"Knowledge"</strong> Tab တွင် ဖြည့်သွင်းပါ။ သင့် Chatbot သည် ဤအချက်အလက်များကို ကိုးကား၍ Customer များအား တိကျမှန်ကန်စွာ အလိုအလျောက် ပြန်လည်ဖြေကြားပေးမည် ဖြစ်ပါသည်။</p>
                </div>
              )}
              {inAppTourStep === 2 && (
                <div style={{ animation: 'fadeIn 0.3s' }}>
                  <div style={{ width: '68px', height: '68px', borderRadius: '22px', background: 'rgba(210, 153, 34, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', margin: '0 auto 20px', color: 'var(--yellow)' }}>⚙️</div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '10px', color: 'var(--text-main)' }}>၂။ System Prompt (စရိုက်လက္ခဏာ သတ်မှတ်ခြင်း)</h3>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}><strong>"Prompt"</strong> Tab တွင် Chatbot ၏ စရိုက်၊ စကားပြောပုံစံ (ဥပမာ- ယဉ်ကျေးပျူငှာသော အရောင်းကိုယ်စားလှယ် သို့မဟုတ် FAQ Bot) နှင့် လိုက်နာရမည့် ညွှန်ကြားချက်များကို သတ်မှတ်ပါ။ ၎င်းသည် AI ၏ စကားပြောလေသံနှင့် လမ်းညွှန်ချက်များကို ထိန်းချုပ်ပေးသည်။</p>
                </div>
              )}
              {inAppTourStep === 3 && (
                <div style={{ animation: 'fadeIn 0.3s' }}>
                  <div style={{ width: '68px', height: '68px', borderRadius: '22px', background: 'rgba(63, 185, 80, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', margin: '0 auto 20px', color: 'var(--green)' }}>💬</div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '10px', color: 'var(--text-main)' }}>၃။ Live Chats & Profile (စကားပြောခြင်းနှင့် စာရင်းများ)</h3>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}><strong>"Chats"</strong> Tab တွင် Customer များနှင့် ပြောဆိုထားသော စကားဝိုင်းများကို စောင့်ကြည့်ပြီး AI ဖြေကြားချက်များကို လိုအပ်ပါက ဝင်ရောက်ပြင်ဆင်/ကိုယ်တိုင်ပြန်ကြားနိုင်ပါသည်။ <strong>"Profile"</strong> Tab တွင် လက်ကျန် Credit များအား စစ်ဆေးနိုင်ပါသည်။</p>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '28px', gap: '12px' }}>
                {inAppTourStep > 1 ? (
                  <button className="btn btn-ghost" style={{ flex: 1, minHeight: '40px' }} onClick={() => setInAppTourStep((prev) => prev - 1)}>Back</button>
                ) : <div style={{ flex: 1 }} />}
                {inAppTourStep < 3 ? (
                  <button className="btn btn-primary" style={{ flex: 1, minHeight: '40px' }} onClick={() => setInAppTourStep((prev) => prev + 1)}>Next</button>
                ) : (
                  <button className="btn btn-primary" style={{ flex: 1, minHeight: '40px', background: 'var(--green)' }} onClick={() => { localStorage.setItem('chatbot_admin_intro_completed', 'true'); setShowInAppTour(false); }}>Finish</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CREATE CHATBOT MODAL */}
      {showCreateBotModal && (
        <div className="modal-backdrop" style={{ zIndex: 1050, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="tg-modal" style={{ maxWidth: '380px', borderRadius: '14px', margin: '16px' }} onClick={(e) => e.stopPropagation()}>
            <div className="tg-modal-header">
              <h3>Create Your Chatbot</h3>
              <button
                className="btn btn-ghost"
                style={{ width: 'auto', padding: '4px 10px', fontSize: '0.8rem', minHeight: '30px' }}
                onClick={() => setShowCreateBotModal(false)}
              >
                Cancel
              </button>
            </div>
            <div className="tg-modal-body" style={{ padding: '20px' }}>
              {createBotError && (
                <div className="alert-box alert-error" style={{ marginBottom: '14px' }}>⚠️ {createBotError}</div>
              )}
              <form onSubmit={handleCreateChatbot}>
                <div className="form-group">
                  <label>Bot Display Name</label>
                  <input className="form-control" type="text" required placeholder="e.g., My Business Bot"
                    value={newBotName} onChange={(e) => setNewBotName(e.target.value)} />
                </div>
                
                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ margin: 0 }}>Bot Token</label>
                    <button
                      type="button"
                      style={{
                        border: 'none',
                        background: 'none',
                        color: 'var(--text-link)',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        padding: 0
                      }}
                      onClick={() => setShowTokenHelpModal(true)}
                    >
                      ℹ️ Token ဘယ်လိုယူရမလဲ?
                    </button>
                  </div>
                  <input className="form-control" type="text" required placeholder="123456789:ABCDefgh..."
                    value={newBotToken} onChange={(e) => setNewBotToken(e.target.value)} />
                </div>

                <div className="form-group">
                  <label>Platform</label>
                  <select className="form-control" value={newBotType} onChange={(e) => setNewBotType(e.target.value as any)}>
                    <option value="telegram">Telegram Bot</option>
                    <option value="facebook">Facebook Messenger</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Bot Role / Persona</label>
                  <select className="form-control" value={newBotRole} onChange={(e) => setNewBotRole(e.target.value as any)}>
                    <option value="sales">Sales Representative</option>
                    <option value="faq">FAQ Answering</option>
                    <option value="support">Customer Support</option>
                    <option value="custom">Custom (Blank slate)</option>
                  </select>
                </div>
                <button className="btn btn-primary" style={{ marginTop: '16px', width: '100%' }} type="submit" disabled={creatingBot}>
                  {creatingBot ? 'Creating...' : '🚀 Create Chatbot'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* TOKEN HELPER MODAL */}
      {showTokenHelpModal && (
        <div className="modal-backdrop" style={{ zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="tg-modal" style={{ maxWidth: '420px', borderRadius: '14px', margin: '16px', overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
            <div className="tg-modal-header" style={{ paddingBottom: '12px', borderBottom: 'none' }}>
              <h3 style={{ fontSize: '1rem' }}>Bot Token ရယူနည်း</h3>
              <button
                className="btn btn-ghost"
                style={{ width: 'auto', padding: '4px 10px', fontSize: '0.8rem', minHeight: '30px', background: 'var(--bg-card)' }}
                onClick={() => { setShowTokenHelpModal(false); setTokenHelpTab(1); }}
              >
                ✕ Close
              </button>
            </div>
            
            {/* TABS */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 16px' }}>
              {['၁. ရှာဖွေပါ', '၂. ဖန်တီးပါ', '၃. Token ယူပါ'].map((title, idx) => {
                const step = idx + 1;
                const isActive = tokenHelpTab === step;
                return (
                  <button
                    key={step}
                    onClick={() => setTokenHelpTab(step)}
                    style={{
                      flex: 1,
                      background: 'none',
                      border: 'none',
                      padding: '10px 0',
                      fontSize: '0.82rem',
                      fontWeight: isActive ? 600 : 400,
                      color: isActive ? 'var(--blue)' : 'var(--text-muted)',
                      borderBottom: isActive ? '2px solid var(--blue)' : '2px solid transparent',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    {title}
                  </button>
                );
              })}
            </div>

            <div className="tg-modal-body" style={{ padding: '20px', fontSize: '0.85rem', lineHeight: 1.6, minHeight: '260px' }}>
              {tokenHelpTab === 1 && (
                <div style={{ textAlign: 'center', animation: 'fadeIn 0.3s' }}>
                  <div style={{ width: '100%', height: '140px', background: 'var(--bg-card)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px', border: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '3rem' }}>🔍</span>
                  </div>
                  <p>
                    Telegram App တွင် <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue)', fontWeight: 600 }}>@BotFather</a> ဟု ရှာဖွေပါ။ ထို့နောက် <strong>Start</strong> ခလုတ်ကို နှိပ်ပါ။
                  </p>
                </div>
              )}
              {tokenHelpTab === 2 && (
                <div style={{ textAlign: 'center', animation: 'fadeIn 0.3s' }}>
                  <div style={{ width: '100%', height: '140px', background: 'var(--bg-card)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px', border: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '3rem' }}>🤖</span>
                  </div>
                  <p>
                    စာတိုပေးပို့ရန်နေရာတွင် <code>/newbot</code> ဟု ရေးသားပေးပို့ပါ။ ထို့နောက် သင့် Bot အတွက် <strong>နာမည် (Display Name)</strong> နှင့် <strong>Username</strong> (ဥပမာ- <code>my_shop_bot</code>) သတ်မှတ်ပေးပါ။
                  </p>
                </div>
              )}
              {tokenHelpTab === 3 && (
                <div style={{ textAlign: 'center', animation: 'fadeIn 0.3s' }}>
                  <div style={{ width: '100%', height: '140px', background: 'var(--bg-card)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px', border: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '3rem' }}>🔑</span>
                  </div>
                  <p>
                    BotFather မှ <strong>HTTP API Token</strong> (ဥပမာ- <code>123456789:AA...</code>) တစ်ခု ပေးပို့လာပါမည်။ ၎င်းကို ကူးယူ (Copy) ပြီး ယခင်စာမျက်နှာတွင် ပြန်ထည့်ပေးပါ။
                  </p>
                </div>
              )}
            </div>
            
            <div style={{ padding: '0 20px 20px', display: 'flex', justifyContent: 'space-between' }}>
              {tokenHelpTab > 1 ? (
                <button className="btn btn-ghost" style={{ width: '80px', minHeight: '36px', fontSize: '0.8rem' }} onClick={() => setTokenHelpTab(prev => prev - 1)}>Back</button>
              ) : <div style={{ width: '80px' }} />}
              
              {tokenHelpTab < 3 ? (
                <button className="btn btn-primary" style={{ width: '80px', minHeight: '36px', fontSize: '0.8rem' }} onClick={() => setTokenHelpTab(prev => prev + 1)}>Next</button>
              ) : (
                <button className="btn btn-primary" style={{ width: '100px', minHeight: '36px', fontSize: '0.8rem' }} onClick={() => { setShowTokenHelpModal(false); setTokenHelpTab(1); }}>Got it!</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
