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
  metadata?: {
    chatbot_id?: number | string;
    source?: string;
  };
}

export default function App() {
  // Auth state
  const [token, setToken] = useState<string | null>(localStorage.getItem('chatbot_admin_token'));
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [chatbot, setChatbot] = useState<ChatbotDetails | null>(null);
  const [credits, setCredits] = useState<number>(0);
  const [loadingProfile, setLoadingProfile] = useState(false);

  // Auth form state
  const [isLoginTab, setIsLoginTab] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [authError, setAuthError] = useState('');
  const [submittingAuth, setSubmittingAuth] = useState(false);

  // Navigation tab: 'chats' | 'knowledge' | 'prompt' | 'profile'
  const [activeTab, setActiveTab] = useState<'chats' | 'knowledge' | 'prompt' | 'profile'>('chats');

  // Conversations tab state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingConvs, setLoadingConvs] = useState(false);

  // Active Chat Screen state (Overlay sub-page)
  const [activeChatSender, setActiveChatSender] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Knowledge tab state
  const [chunks, setChunks] = useState<KnowledgeChunk[]>([]);
  const [loadingChunks, setLoadingChunks] = useState(false);
  const [ingestText, setIngestText] = useState('');
  const [ingesting, setIngesting] = useState(false);

  // Prompt tab state
  const [systemPrompt, setSystemPrompt] = useState('');
  const [activePrompt, setActivePrompt] = useState('');
  const [loadingPrompt, setLoadingPrompt] = useState(false);
  const [updatingPrompt, setUpdatingPrompt] = useState(false);

  // Edit Chatbot (Profile) state
  const [editBotName, setEditBotName] = useState('');
  const [editBotDesc, setEditBotDesc] = useState('');
  const [updatingBot, setUpdatingBot] = useState(false);

  // Standalone bot creation state
  const [newBotName, setNewBotName] = useState('');
  const [newBotToken, setNewBotToken] = useState('');
  const [newBotType, setNewBotType] = useState<'telegram' | 'facebook'>('telegram');
  const [newBotRole, setNewBotRole] = useState<'sales' | 'faq' | 'support' | 'custom'>('sales');
  const [creatingBot, setCreatingBot] = useState(false);
  const [createBotError, setCreateBotError] = useState('');

  // Knowledge edit state
  const [editingChunk, setEditingChunk] = useState<KnowledgeChunk | null>(null);
  const [editText, setEditText] = useState('');
  const [updatingChunk, setUpdatingChunk] = useState(false);
  const [editError, setEditError] = useState('');

  // Referral / Upgrade states
  const [referralCode, setReferralCode] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<'lite' | 'basic' | 'pro' | null>(null);
  const [kpayDetails, setKpayDetails] = useState<{ resellerId: number | null; kpay_no: string; kpay_name: string; note?: string } | null>(null);
  const [loadingKpay, setLoadingKpay] = useState(false);
  const [receiptBase64, setReceiptBase64] = useState<string | null>(null);
  const [receiptFilename, setReceiptFilename] = useState('');
  const [submittingUpgrade, setSubmittingUpgrade] = useState(false);
  const [upgradeMsg, setUpgradeMsg] = useState('');
  const [businessPlanInfo, setBusinessPlanInfo] = useState<any>(null);

  // Fetch admin profile and bot details
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
    if (token) {
      fetchProfile();
    }
  }, [token, fetchProfile]);

  // Tab change reactions
  useEffect(() => {
    if (!token) return;
    if (activeTab === 'chats') {
      loadConversations();
    } else if (activeTab === 'knowledge' && profile?.canManageKnowledge) {
      loadKnowledge();
    } else if (activeTab === 'prompt' && profile?.canManageSystemPrompt) {
      loadSystemPrompt();
    }
  }, [activeTab, token, profile]);

  // Load chat list
  const loadConversations = async () => {
    setLoadingConvs(true);
    try {
      const data = await getConversations();
      setConversations(data.conversations || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingConvs(false);
    }
  };

  // Load specific chat messages
  const loadMessagesForSender = async (senderId: string) => {
    setLoadingMsgs(true);
    try {
      const data = await getMessages(senderId, 100, 0);
      setMessages(data.messages || []);
      // Scroll to bottom
      setTimeout(scrollToBottom, 80);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMsgs(false);
    }
  };

  // Poll messages while active chat is open
  useEffect(() => {
    if (!activeChatSender) return;
    const interval = setInterval(() => {
      getMessages(activeChatSender, 100, 0)
        .then((data) => {
          if (data.messages && data.messages.length !== messages.length) {
            setMessages(data.messages);
            scrollToBottom();
          }
        })
        .catch(console.error);
    }, 4000);
    return () => clearInterval(interval);
  }, [activeChatSender, messages.length]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Load knowledge chunks
  const loadKnowledge = async () => {
    setLoadingChunks(true);
    try {
      const data = await getKnowledgeChunks(100, 0);
      setChunks(data.chunks || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingChunks(false);
    }
  };

  // Load System Prompt
  const loadSystemPrompt = async () => {
    setLoadingPrompt(true);
    try {
      const data = await getSystemPrompt();
      setSystemPrompt(data.customSystemPrompt || '');
      setActivePrompt(data.activePrompt || '');
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingPrompt(false);
    }
  };

  // Handlers
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setSubmittingAuth(true);
    try {
      const data = await apiLogin(email, password);
      if (data.success && data.token) {
        localStorage.setItem('chatbot_admin_token', data.token);
        setToken(data.token);
        // Clean fields
        setEmail('');
        setPassword('');
      }
    } catch (err: any) {
      setAuthError(err.response?.data?.error || 'Invalid credentials');
    } finally {
      setSubmittingAuth(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setSubmittingAuth(true);
    try {
      const data = await apiRegister({
        name,
        email,
        password,
        referralCode: referralCode || undefined,
      });
      if (data.success && data.token) {
        localStorage.setItem('chatbot_admin_token', data.token);
        setToken(data.token);
        // Clean fields
        setName('');
        setEmail('');
        setPassword('');
        setReferralCode('');
      }
    } catch (err: any) {
      setAuthError(err.response?.data?.error || 'Registration failed');
    } finally {
      setSubmittingAuth(false);
    }
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
        setNewBotName('');
        setNewBotToken('');
        fetchProfile();
      }
    } catch (err: any) {
      setCreateBotError(err.response?.data?.error || 'Failed to create chatbot');
    } finally {
      setCreatingBot(false);
    }
  };

  const handleSelectPlan = async (plan: 'lite' | 'basic' | 'pro') => {
    setSelectedPlan(plan);
    setLoadingKpay(true);
    setUpgradeMsg('');
    setReceiptBase64(null);
    setReceiptFilename('');
    try {
      const data = await getPaymentMethods(plan);
      if (data.success) {
        setKpayDetails(data);
      }
    } catch (e) {
      console.error(e);
      alert('Failed to load payment details.');
    } finally {
      setLoadingKpay(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReceiptFilename(file.name);
    const reader = new FileReader();
    reader.onloadend = () => {
      setReceiptBase64(reader.result as string);
    };
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
        setUpgradeMsg('✅ Upgrade request submitted successfully! Waiting for Reseller verification.');
        setTimeout(() => {
          setSelectedPlan(null);
          setKpayDetails(null);
          setReceiptBase64(null);
          setReceiptFilename('');
          fetchProfile();
        }, 2500);
      }
    } catch (err: any) {
      setUpgradeMsg(`❌ ${err.response?.data?.error || 'Upgrade failed'}`);
    } finally {
      setSubmittingUpgrade(false);
    }
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
    } finally {
      setUpdatingChunk(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('chatbot_admin_token');
    localStorage.removeItem('chatbot_admin_profile');
    setToken(null);
    setProfile(null);
    setChatbot(null);
    setActiveChatSender(null);
    setMessages([]);
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !activeChatSender || sendingReply) return;
    setSendingReply(true);
    try {
      const data = await replyToConversation(activeChatSender, replyText.trim());
      if (data.success && data.message) {
        setMessages((prev) => [...prev, data.message]);
        setReplyText('');
        // Deduct 1 credit locally
        setCredits((prev) => Math.max(0, prev - 1));
        setTimeout(scrollToBottom, 50);
      }
    } catch (e) {
      console.error(e);
      alert('Failed to send reply');
    } finally {
      setSendingReply(false);
    }
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
    } finally {
      setIngesting(false);
    }
  };

  const handleDeleteChunk = async (docId: string) => {
    if (!confirm('Delete this knowledge chunk?')) return;
    try {
      await deleteChunk(docId);
      setChunks((prev) => prev.filter((c) => c.id !== docId));
    } catch (e) {
      alert('Failed to delete chunk');
    }
  };

  const handleUpdatePrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdatingPrompt(true);
    try {
      const result = await updateSystemPrompt(systemPrompt);
      if (result.success) {
        alert('System prompt updated successfully');
      }
    } catch (e: any) {
      alert(e.response?.data?.error || 'Update failed');
    } finally {
      setUpdatingPrompt(false);
    }
  };

  const handleUpdateBotMetadata = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatbot || updatingBot) return;
    setUpdatingBot(true);
    try {
      const result = await updateChatbot(editBotName, editBotDesc);
      if (result.success) {
        setChatbot(result.chatbot);
        alert('Chatbot details updated successfully');
      }
    } catch (e) {
      alert('Failed to update chatbot');
    } finally {
      setUpdatingBot(false);
    }
  };

  const getInitials = (str: string) => {
    if (!str) return 'U';
    return str.slice(-2).toUpperCase();
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  };

  // ─── AUTHENTICATION VIEW ─────────────────────────────────────────────────
  if (!token) {
    return (
      <div className="auth-wrapper">
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ fontSize: '3rem' }}>🤖</div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, letterSpacing: '-0.3px', margin: '8px 0 2px' }}>Chatbot Admin Platform</h1>
          <p style={{ fontSize: '0.82rem', color: 'var(--tg-text-muted)' }}>Manage your automated agent & conversations</p>
        </div>

        <div className="auth-card">
          <div className="auth-tabs">
            <button className={`auth-tab ${isLoginTab ? 'active' : ''}`} onClick={() => { setIsLoginTab(true); setAuthError(''); }}>Login</button>
            <button className={`auth-tab ${!isLoginTab ? 'active' : ''}`} onClick={() => { setIsLoginTab(false); setAuthError(''); }}>Register Bot</button>
          </div>

          {authError && (
            <div style={{ padding: '8px 12px', background: 'rgba(236,59,59,0.1)', color: 'var(--tg-red)', borderRadius: '6px', fontSize: '0.8rem', marginBottom: '16px' }}>
              ⚠️ {authError}
            </div>
          )}

          {isLoginTab ? (
            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label>Email Address</label>
                <input className="form-control" type="email" required placeholder="name@domain.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input className="form-control" type="password" required placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <button className="btn btn-primary" style={{ marginTop: '8px' }} type="submit" disabled={submittingAuth}>
                {submittingAuth ? 'Logging in...' : 'Sign In'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister}>
              <h3 style={{ fontSize: '0.85rem', color: 'var(--tg-blue)', textTransform: 'uppercase', marginBottom: '10px', letterSpacing: '0.5px' }}>Register Standalone Account</h3>
              <div className="form-group">
                <label>Your Name</label>
                <input className="form-control" type="text" required placeholder="John Doe" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Email Address</label>
                <input className="form-control" type="email" required placeholder="john@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input className="form-control" type="password" required placeholder="Minimum 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Referral Reseller Code (Optional)</label>
                <input className="form-control" type="text" placeholder="e.g. 1002" value={referralCode} onChange={(e) => setReferralCode(e.target.value)} />
              </div>

              <div style={{ marginTop: '8px', fontSize: '0.75rem', color: 'var(--tg-text-muted)', marginBottom: '14px', lineHeight: 1.4 }}>
                ℹ️ Registering an account lets you create chatbots, customize system prompts, upload knowledge bases, and upgrade to premium plans.
              </div>

              <button className="btn btn-primary" type="submit" disabled={submittingAuth}>
                {submittingAuth ? 'Creating Account...' : 'Register'}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // ─── DEFERRED CHATBOT CREATION WIZARD ────────────────────────────────────
  if (token && !loadingProfile && !chatbot) {
    return (
      <div className="auth-wrapper">
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ fontSize: '3.5rem' }}>✨</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.3px', margin: '8px 0 2px' }}>Create Your Chatbot</h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--tg-text-muted)', padding: '0 20px' }}>Let's set up your first chatbot assistant to start managing conversations.</p>
        </div>

        <div className="auth-card">
          {createBotError && (
            <div style={{ padding: '8px 12px', background: 'rgba(236,59,59,0.1)', color: 'var(--tg-red)', borderRadius: '6px', fontSize: '0.8rem', marginBottom: '16px' }}>
              ⚠️ {createBotError}
            </div>
          )}

          <form onSubmit={handleCreateChatbot}>
            <div className="form-group">
              <label>Bot Display Name</label>
              <input className="form-control" type="text" required placeholder="e.g., My Business Assistant" value={newBotName} onChange={(e) => setNewBotName(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Telegram Bot Token</label>
              <input className="form-control" type="text" required placeholder="123456789:ABCDefgh..." value={newBotToken} onChange={(e) => setNewBotToken(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Platform</label>
              <select className="form-control" value={newBotType} onChange={(e) => setNewBotType(e.target.value as any)}>
                <option value="telegram">Telegram Bot</option>
                <option value="facebook">Facebook Messenger</option>
              </select>
            </div>
            <div className="form-group">
              <label>Bot Persona/Role Strategy</label>
              <select className="form-control" value={newBotRole} onChange={(e) => setNewBotRole(e.target.value as any)}>
                <option value="sales">Sales Representative (Lead gen & products)</option>
                <option value="faq">FAQ Answering (Business policies & Q&A)</option>
                <option value="support">Customer Support (Help desk assistant)</option>
                <option value="custom">Custom Agent (Blank slate instructions)</option>
              </select>
            </div>

            <button className="btn btn-primary" style={{ marginTop: '16px' }} type="submit" disabled={creatingBot}>
              {creatingBot ? 'Creating Chatbot...' : '🚀 Create Chatbot'}
            </button>

            <button className="btn btn-ghost" style={{ marginTop: '8px', width: '100%' }} type="button" onClick={handleLogout}>
              Logout
            </button>
          </form>
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
          <h2>{chatbot?.name || 'Loading bot...'}</h2>
          <div className="app-header-subtitle">
            {profile?.isStandalone ? 'Standalone Bot' : 'Business Managed'} · {credits} Credits
          </div>
        </div>
        <button className="btn btn-ghost" style={{ width: 'auto', padding: '6px 10px', fontSize: '0.8rem' }} onClick={handleLogout}>
          🚪 Logout
        </button>
      </header>

      {/* CONTENT SCROLL AREA */}
      <main className="app-content">
        {loadingProfile ? (
          <div className="loading-container">
            <div className="spinner" />
            <p>Syncing credentials...</p>
          </div>
        ) : (
          <>
            {/* TABS CONTAINER */}

            {/* CHATS TAB */}
            {activeTab === 'chats' && (
              <div>
                {loadingConvs ? (
                  <div className="loading-container">
                    <div className="spinner" />
                    <p>Fetching active threads...</p>
                  </div>
                ) : conversations.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--tg-text-muted)' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>💬</div>
                    <p>No active conversations yet.</p>
                    <p style={{ fontSize: '0.75rem', marginTop: '4px' }}>Incoming telegram bot chats will populate here.</p>
                  </div>
                ) : (
                  <div className="chat-list">
                    {conversations.map((conv) => (
                      <div key={conv.sender_id} className="chat-list-item" onClick={() => { setActiveChatSender(conv.sender_id); loadMessagesForSender(conv.sender_id); }}>
                        <div className="chat-list-avatar">{getInitials(conv.sender_id)}</div>
                        <div className="chat-list-details">
                          <div className="chat-list-meta">
                            <div className="chat-list-name">User {conv.sender_id}</div>
                            <div className="chat-list-time">{formatDate(conv.last_message_at)}</div>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div className="chat-list-preview">Click to view thread & reply</div>
                            <span className="chat-list-badge">{conv.message_count}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* KNOWLEDGE BASE TAB */}
            {activeTab === 'knowledge' && (
              <div className="settings-list">
                {!profile?.canManageKnowledge ? (
                  <div className="settings-card" style={{ textAlign: 'center', color: 'var(--tg-text-muted)', padding: '24px' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>🔒</div>
                    <h3>Permission Required</h3>
                    <p style={{ fontSize: '0.8rem', marginTop: '6px', lineHeight: 1.4 }}>
                      Your admin account does not have permission to view or edit the chatbot's Knowledge Base. Please contact the Business Admin.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="settings-card">
                      <div className="settings-card-title">📚 Ingest Document</div>
                      <form onSubmit={handleIngest}>
                        <div className="form-group">
                          <label>Text Content (Myanmar text supported)</label>
                          <textarea
                            className="form-control"
                            style={{ height: '120px', resize: 'vertical' }}
                            required
                            placeholder="ရိုက်ထည့်ရန် စာသား သို့မဟုတ် chunking လုပ်မည့် knowledge base သတင်းအချက်အလက်..."
                            value={ingestText}
                            onChange={(e) => setIngestText(e.target.value)}
                          />
                        </div>
                        <button className="btn btn-primary" type="submit" disabled={ingesting || !ingestText.trim()}>
                          {ingesting ? 'Chunking & Ingesting...' : 'Add Knowledge'}
                        </button>
                      </form>
                    </div>

                    <div className="settings-card">
                      <div className="settings-card-title">Document Chunks ({chunks.length})</div>
                      {loadingChunks ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '16px' }}><div className="spinner" /></div>
                      ) : chunks.length === 0 ? (
                        <p style={{ fontSize: '0.85rem', color: 'var(--tg-text-muted)', textAlign: 'center' }}>Knowledge base is currently empty.</p>
                      ) : (
                        <div>
                          {chunks.map((chunk) => (
                            <div key={chunk.id} className="chunk-card">
                              <div className="chunk-card-meta">
                                <span>ID: {chunk.id.slice(0, 16)}...</span>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                  <button
                                    className="btn btn-ghost"
                                    style={{ color: 'var(--tg-blue)', width: 'auto', padding: '2px 6px', fontSize: '0.7rem', height: 'auto' }}
                                    onClick={() => { setEditingChunk(chunk); setEditText(chunk.text); setEditError(''); }}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    className="btn btn-ghost"
                                    style={{ color: 'var(--tg-red)', width: 'auto', padding: '2px 6px', fontSize: '0.7rem', height: 'auto' }}
                                    onClick={() => handleDeleteChunk(chunk.id)}
                                  >
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

                    {/* Edit Chunk Dialog */}
                    {editingChunk && (
                      <div className="confirm-overlay" style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(8px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100
                      }} onClick={() => setEditingChunk(null)}>
                        <div className="confirm-box" style={{
                          background: 'rgba(25, 25, 35, 0.95)',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          borderRadius: '12px', padding: '20px', width: '90%', maxWidth: '500px'
                        }} onClick={(e) => e.stopPropagation()}>
                          <h3 style={{ margin: '0 0 12px 0' }}>✏️ Edit Chunk</h3>
                          {editError && (
                            <div style={{ color: 'var(--tg-red)', fontSize: '0.8rem', marginBottom: '10px' }}>⚠️ {editError}</div>
                          )}
                          <textarea
                            className="form-control"
                            style={{ height: '140px', resize: 'vertical', width: '100%', boxSizing: 'border-box' }}
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                          />
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                            <button className="btn btn-ghost" style={{ width: 'auto' }} onClick={() => setEditingChunk(null)}>Cancel</button>
                            <button className="btn btn-primary" style={{ width: 'auto' }} disabled={updatingChunk || !editText.trim()} onClick={handleUpdateChunk}>
                              {updatingChunk ? 'Saving...' : 'Save'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* SYSTEM PROMPT TAB */}
            {activeTab === 'prompt' && (
              <div className="settings-list">
                {!profile?.canManageSystemPrompt ? (
                  <div className="settings-card" style={{ textAlign: 'center', color: 'var(--tg-text-muted)', padding: '24px' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>🔒</div>
                    <h3>Permission Required</h3>
                    <p style={{ fontSize: '0.8rem', marginTop: '6px', lineHeight: 1.4 }}>
                      Your admin account does not have permission to modify the chatbot's System Prompt. Please contact the Business Admin.
                    </p>
                  </div>
                ) : (
                  <div className="settings-card">
                    <div className="settings-card-title">⚙️ Custom System Prompt</div>
                    {loadingPrompt ? (
                      <div style={{ display: 'flex', justifyContent: 'center', padding: '16px' }}><div className="spinner" /></div>
                    ) : (
                      <form onSubmit={handleUpdatePrompt}>
                        <div className="form-group">
                          <label>Define Bot Persona and Instructions</label>
                          <textarea
                            className="form-control"
                            style={{ height: '180px', fontFamily: 'monospace', fontSize: '0.85rem', resize: 'vertical' }}
                            placeholder="Write custom instructions or leave empty to use system fallback template..."
                            value={systemPrompt}
                            onChange={(e) => setSystemPrompt(e.target.value)}
                          />
                        </div>

                        {!systemPrompt && activePrompt && (
                          <div style={{
                            padding: '12px', background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.1)',
                            borderRadius: '8px', margin: '14px 0', fontSize: '0.8rem'
                          }}>
                            <div style={{ fontWeight: 'bold', color: 'var(--tg-blue)', marginBottom: '6px' }}>
                              💡 Fallback Strategy Active: {chatbot?.bot_role?.toUpperCase() || 'SALES'}
                            </div>
                            <div style={{ whiteSpace: 'pre-wrap', color: 'var(--tg-text-muted)', maxHeight: '150px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '0.75rem', lineHeight: 1.4 }}>
                              {activePrompt}
                            </div>
                          </div>
                        )}

                        <button className="btn btn-primary" type="submit" disabled={updatingPrompt}>
                          {updatingPrompt ? 'Saving Prompt...' : 'Update System Prompt'}
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* PROFILE / SETTINGS TAB */}
            {activeTab === 'profile' && (
              <div className="settings-list">
                {chatbot && profile?.isStandalone && (
                  <div className="settings-card">
                    <div className="settings-card-title">🤖 Bot Information</div>
                    <form onSubmit={handleUpdateBotMetadata}>
                      <div className="form-group">
                        <label>Bot Display Name</label>
                        <input className="form-control" type="text" required value={editBotName} onChange={(e) => setEditBotName(e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label>Bot Description</label>
                        <textarea className="form-control" style={{ height: '80px', resize: 'vertical' }} value={editBotDesc} onChange={(e) => setEditBotDesc(e.target.value)} placeholder="Introduce what this bot does..." />
                      </div>
                      <button className="btn btn-primary" type="submit" disabled={updatingBot}>
                        {updatingBot ? 'Updating details...' : 'Save Bot Info'}
                      </button>
                    </form>
                  </div>
                )}

                <div className="settings-card">
                  <div className="settings-card-title">👤 Admin Account Details</div>
                  <div className="settings-row">
                    <div className="settings-label">Name</div>
                    <div className="settings-value">{profile?.name}</div>
                  </div>
                  <div className="settings-row">
                    <div className="settings-label">Email</div>
                    <div className="settings-value">{profile?.email}</div>
                  </div>
                  <div className="settings-row">
                    <div className="settings-label">Account Type</div>
                    <div className="settings-value">
                      {profile?.isStandalone ? (
                        <span className="badge badge-green">Standalone Bot</span>
                      ) : (
                        <span className="badge badge-blue">Business Assigned</span>
                      )}
                    </div>
                  </div>
                  <div className="settings-row">
                    <div className="settings-label">Message Credits</div>
                    <div className="settings-value" style={{ fontWeight: 'bold', color: 'var(--tg-blue)' }}>{credits}</div>
                  </div>
                </div>

                {profile?.isStandalone && (
                  <div className="settings-card">
                    <div className="settings-card-title">💳 Subscription Plan & Upgrade</div>
                    
                    <div className="settings-row" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '12px', marginBottom: '16px' }}>
                      <div className="settings-label">Active Plan</div>
                      <div className="settings-value" style={{ textTransform: 'capitalize', fontWeight: 'bold', color: 'var(--tg-blue)' }}>
                        {businessPlanInfo?.plan === 'subscription' ? `${businessPlanInfo?.subscriptionPlan} Plan 🚀` : 'Free Tier (Prepaid)'}
                      </div>
                    </div>
                    {businessPlanInfo?.subscriptionEndDate && (
                      <div className="settings-row" style={{ marginBottom: '20px' }}>
                        <div className="settings-label">Expiry Date</div>
                        <div className="settings-value" style={{ color: 'var(--tg-text-muted)', fontSize: '0.82rem' }}>
                          {new Date(businessPlanInfo.subscriptionEndDate).toLocaleDateString()}
                        </div>
                      </div>
                    )}

                    <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem' }}>Choose Plan to Upgrade:</h4>
                    <div className="plans-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginBottom: '20px' }}>
                      <div className={`plan-card-option ${selectedPlan === 'lite' ? 'selected' : ''}`} onClick={() => handleSelectPlan('lite')} style={{
                        padding: '14px 10px', border: selectedPlan === 'lite' ? '2px solid var(--tg-blue)' : '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '8px', cursor: 'pointer', textAlign: 'center', background: 'rgba(255,255,255,0.02)'
                      }}>
                        <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>Lite</div>
                        <div style={{ color: 'var(--tg-blue)', fontSize: '0.95rem', margin: '4px 0', fontWeight: 'bold' }}>3,000 MMK</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--tg-text-muted)' }}>500 Msg Credits</div>
                      </div>

                      <div className={`plan-card-option ${selectedPlan === 'basic' ? 'selected' : ''}`} onClick={() => handleSelectPlan('basic')} style={{
                        padding: '14px 10px', border: selectedPlan === 'basic' ? '2px solid var(--tg-blue)' : '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '8px', cursor: 'pointer', textAlign: 'center', background: 'rgba(255,255,255,0.02)'
                      }}>
                        <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>Basic</div>
                        <div style={{ color: 'var(--tg-blue)', fontSize: '0.95rem', margin: '4px 0', fontWeight: 'bold' }}>15,000 MMK</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--tg-text-muted)' }}>3,000 Msg Credits</div>
                      </div>

                      <div className={`plan-card-option ${selectedPlan === 'pro' ? 'selected' : ''}`} onClick={() => handleSelectPlan('pro')} style={{
                        padding: '14px 10px', border: selectedPlan === 'pro' ? '2px solid var(--tg-blue)' : '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '8px', cursor: 'pointer', textAlign: 'center', background: 'rgba(255,255,255,0.02)'
                      }}>
                        <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>Pro</div>
                        <div style={{ color: 'var(--tg-blue)', fontSize: '0.95rem', margin: '4px 0', fontWeight: 'bold' }}>30,000 MMK</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--tg-text-muted)' }}>10,000 Msg Credits</div>
                      </div>
                    </div>

                    {selectedPlan && (
                      <div className="payment-checkout-box" style={{
                        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: '8px', padding: '16px'
                      }}>
                        {loadingKpay ? (
                          <div style={{ display: 'flex', justifyContent: 'center' }}><div className="spinner" /></div>
                        ) : (
                          <form onSubmit={handleSubmitUpgrade}>
                            <h4 style={{ margin: '0 0 12px 0', color: 'var(--tg-blue)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                              💳 KBZ Pay Transfer Details
                            </h4>
                            
                            <div className="settings-row" style={{ margin: '8px 0' }}>
                              <div className="settings-label" style={{ fontSize: '0.8rem' }}>KPay Phone</div>
                              <div className="settings-value" style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{kpayDetails?.kpay_no}</div>
                            </div>
                            
                            <div className="settings-row" style={{ margin: '8px 0' }}>
                              <div className="settings-label" style={{ fontSize: '0.8rem' }}>Account Name</div>
                              <div className="settings-value" style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{kpayDetails?.kpay_name}</div>
                            </div>

                            <div className="settings-row" style={{ margin: '8px 0' }}>
                              <div className="settings-label" style={{ fontSize: '0.8rem' }}>Amount Due</div>
                              <div className="settings-value" style={{ fontWeight: 'bold', fontSize: '0.9rem', color: 'var(--tg-green)' }}>
                                {selectedPlan === 'lite' ? '3,000' : selectedPlan === 'basic' ? '15,000' : '30,000'} MMK
                              </div>
                            </div>

                            <p style={{ fontSize: '0.72rem', color: 'var(--tg-text-muted)', lineHeight: 1.4, margin: '12px 0' }}>
                              💡 Transfer exact amount via KBZ Pay to the details above. Then, upload your transaction screenshot receipt below. 
                              For direct support, contact us on Telegram: <a href="https://t.me/platform_billing_support" target="_blank" rel="noreferrer" style={{ color: 'var(--tg-blue)', textDecoration: 'underline' }}>@platform_support</a>.
                            </p>

                            <div className="form-group">
                              <label style={{ fontSize: '0.78rem', marginBottom: '6px' }}>Upload KPay Screenshot</label>
                              <div className="file-input-wrapper" style={{
                                position: 'relative', overflow: 'hidden', display: 'inline-block', width: '100%'
                              }}>
                                <input type="file" accept="image/*" required onChange={handleFileChange} style={{
                                  position: 'absolute', top: 0, left: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%'
                                }} />
                                <button className="btn btn-ghost" type="button" style={{ width: '100%', fontSize: '0.85rem', border: '1px dashed rgba(255,255,255,0.15)' }}>
                                  {receiptFilename ? `📎 ${receiptFilename}` : '📁 Choose Screenshot File'}
                                </button>
                              </div>
                            </div>

                            {upgradeMsg && (
                              <div style={{
                                padding: '8px 12px', borderRadius: '6px', fontSize: '0.8rem', margin: '12px 0 0 0',
                                background: upgradeMsg.startsWith('✅') ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)',
                                color: upgradeMsg.startsWith('✅') ? '#34d399' : '#f87171',
                                border: `1px solid ${upgradeMsg.startsWith('✅') ? 'rgba(52,211,153,0.2)' : 'rgba(248,113,113,0.2)'}`
                              }}>
                                {upgradeMsg}
                              </div>
                            )}

                            <button className="btn btn-primary" style={{ marginTop: '14px' }} type="submit" disabled={submittingUpgrade || !receiptBase64}>
                              {submittingUpgrade ? 'Submitting Receipt...' : '🚀 Submit Upgrade Request'}
                            </button>
                          </form>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="settings-card">
                  <div className="settings-card-title">🔒 Assigned Permissions</div>
                  <div className="settings-row">
                    <div className="settings-label">Knowledge Base CRUD</div>
                    <div className="settings-value">
                      {profile?.canManageKnowledge ? (
                        <span style={{ color: 'var(--tg-green)' }}>Allowed ✅</span>
                      ) : (
                        <span style={{ color: 'var(--tg-red)' }}>Restricted ❌</span>
                      )}
                    </div>
                  </div>
                  <div className="settings-row">
                    <div className="settings-label">System Prompt Modification</div>
                    <div className="settings-value">
                      {profile?.canManageSystemPrompt ? (
                        <span style={{ color: 'var(--tg-green)' }}>Allowed ✅</span>
                      ) : (
                        <span style={{ color: 'var(--tg-red)' }}>Restricted ❌</span>
                      )}
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
        <button className={`nav-item ${activeTab === 'chats' ? 'active' : ''}`} onClick={() => { setActiveTab('chats'); setActiveChatSender(null); }}>
          <span className="nav-icon">💬</span>
          <span>Chats</span>
        </button>
        <button className={`nav-item ${activeTab === 'knowledge' ? 'active' : ''}`} onClick={() => { setActiveTab('knowledge'); setActiveChatSender(null); }}>
          <span className="nav-icon">📚</span>
          <span>Knowledge</span>
        </button>
        <button className={`nav-item ${activeTab === 'prompt' ? 'active' : ''}`} onClick={() => { setActiveTab('prompt'); setActiveChatSender(null); }}>
          <span className="nav-icon">⚙️</span>
          <span>Prompt</span>
        </button>
        <button className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => { setActiveTab('profile'); setActiveChatSender(null); }}>
          <span className="nav-icon">👤</span>
          <span>Profile</span>
        </button>
      </nav>

      {/* ACTIVE CHAT SCREEN OVERLAY (Slide-in thread viewer) */}
      {activeChatSender && (
        <div className="chat-window" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 150, backgroundColor: 'var(--tg-bg-page)' }}>
          {/* Header */}
          <header className="app-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button className="btn btn-ghost" style={{ width: 'auto', padding: '6px', fontSize: '1.1rem' }} onClick={() => setActiveChatSender(null)}>
                ←
              </button>
              <div>
                <h2>User: {activeChatSender}</h2>
                <div className="app-header-subtitle">Live chat history</div>
              </div>
            </div>
          </header>

          {/* Messages list */}
          <div className="chat-messages-container" id="chat-messages-panel">
            {loadingMsgs ? (
              <div className="loading-container">
                <div className="spinner" />
                <p>Retrieving chat history...</p>
              </div>
            ) : messages.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--tg-text-muted)' }}>No messages exchanged yet.</div>
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

          {/* Input reply bar */}
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
            <button className="chat-send-btn" onClick={handleSendReply} disabled={sendingReply || !replyText.trim() || credits <= 0}>
              {sendingReply ? '...' : '✈️'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
