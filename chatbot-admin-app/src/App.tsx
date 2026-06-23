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
  getSystemPrompt,
  updateSystemPrompt,
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
  const [botName, setBotName] = useState('');
  const [botToken, setBotToken] = useState('');
  const [botType, setBotType] = useState<'telegram' | 'facebook'>('telegram');
  const [botRole, setBotRole] = useState<'sales' | 'faq' | 'support' | 'custom'>('sales');
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
  const [loadingPrompt, setLoadingPrompt] = useState(false);
  const [updatingPrompt, setUpdatingPrompt] = useState(false);

  // Edit Chatbot (Profile) state
  const [editBotName, setEditBotName] = useState('');
  const [editBotDesc, setEditBotDesc] = useState('');
  const [updatingBot, setUpdatingBot] = useState(false);

  // Fetch admin profile and bot details
  const fetchProfile = useCallback(async () => {
    setLoadingProfile(true);
    try {
      const data = await getProfile();
      if (data.success) {
        setProfile(data.admin);
        setChatbot(data.chatbot);
        setCredits(data.credits);
        setEditBotName(data.chatbot.name);
        setEditBotDesc(data.chatbot.description || '');
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
        botName,
        botToken,
        botType,
        botRole,
      });
      if (data.success && data.token) {
        localStorage.setItem('chatbot_admin_token', data.token);
        setToken(data.token);
        // Clean fields
        setName('');
        setEmail('');
        setPassword('');
        setBotName('');
        setBotToken('');
      }
    } catch (err: any) {
      setAuthError(err.response?.data?.error || 'Registration failed');
    } finally {
      setSubmittingAuth(false);
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
              <h3 style={{ fontSize: '0.85rem', color: 'var(--tg-blue)', textTransform: 'uppercase', marginBottom: '10px', letterSpacing: '0.5px' }}>Personal Info</h3>
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

              <h3 style={{ fontSize: '0.85rem', color: 'var(--tg-blue)', textTransform: 'uppercase', margin: '20px 0 10px', letterSpacing: '0.5px' }}>Bot Credentials</h3>
              <div className="form-group">
                <label>Bot Name</label>
                <input className="form-control" type="text" required placeholder="Sales FAQ Assistant" value={botName} onChange={(e) => setBotName(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Telegram Bot Token</label>
                <input className="form-control" type="text" required placeholder="123456789:ABCDefgh..." value={botToken} onChange={(e) => setBotToken(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Bot Platform</label>
                <select className="form-control" value={botType} onChange={(e) => setBotType(e.target.value as any)}>
                  <option value="telegram">Telegram Bot</option>
                  <option value="facebook">Facebook Messenger</option>
                </select>
              </div>
              <div className="form-group">
                <label>Initial Bot Role</label>
                <select className="form-control" value={botRole} onChange={(e) => setBotRole(e.target.value as any)}>
                  <option value="sales">Sales Representative</option>
                  <option value="faq">FAQ Answering</option>
                  <option value="support">Customer Support</option>
                  <option value="custom">Custom Agent</option>
                </select>
              </div>

              <div style={{ marginTop: '8px', fontSize: '0.75rem', color: 'var(--tg-text-muted)', marginBottom: '14px', lineHeight: 1.4 }}>
                ℹ️ registering a standalone bot grants <strong>100 free credits</strong>, full prompt modifications, and complete Knowledge Base operations.
              </div>

              <button className="btn btn-primary" type="submit" disabled={submittingAuth}>
                {submittingAuth ? 'Creating Platform...' : 'Register & Setup Bot'}
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
                                <button
                                  className="btn btn-ghost"
                                  style={{ color: 'var(--tg-red)', width: 'auto', padding: '2px 6px', fontSize: '0.7rem', height: 'auto' }}
                                  onClick={() => handleDeleteChunk(chunk.id)}
                                >
                                  Delete
                                </button>
                              </div>
                              <div className="chunk-text">{chunk.text}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
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
                            style={{ height: '220px', fontFamily: 'monospace', fontSize: '0.85rem', resize: 'vertical' }}
                            placeholder="You are a helpful customer support representative..."
                            value={systemPrompt}
                            onChange={(e) => setSystemPrompt(e.target.value)}
                          />
                        </div>
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
