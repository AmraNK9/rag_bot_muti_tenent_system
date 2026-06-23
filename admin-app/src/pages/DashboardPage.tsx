import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getChatbots,
  getCredits,
  getChatbotAdmins,
  createChatbotAdmin,
  updateChatbotAdmin,
  deleteChatbotAdmin,
} from '../api/client';

interface Chatbot {
  id: number;
  name: string;
  type: string;
  bot_role: string;
  token: string;
}

interface Credits {
  plan: string;
  activeMessagesCount: number;
  totalChatbots: number;
}

const roleColors: Record<string, string> = {
  sales: 'badge-sales',
  faq: 'badge-faq',
  support: 'badge-support',
  custom: 'badge-custom',
};

const roleEmoji: Record<string, string> = {
  sales: '💼', faq: '❓', support: '🛠️', custom: '⚙️',
};

export default function DashboardPage() {
  const { business, logout } = useAuth();
  const navigate = useNavigate();
  const [chatbots, setChatbots] = useState<Chatbot[]>([]);
  const [credits, setCredits] = useState<Credits | null>(null);
  const [loading, setLoading] = useState(true);

  // Chatbot Admin Management State
  const [selectedBotForAdmins, setSelectedBotForAdmins] = useState<Chatbot | null>(null);
  const [admins, setAdmins] = useState<any[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const [showAddAdminForm, setShowAddAdminForm] = useState(false);
  const [editingAdminId, setEditingAdminId] = useState<number | null>(null);

  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [canManageKnowledge, setCanManageKnowledge] = useState(false);
  const [canManageSystemPrompt, setCanManageSystemPrompt] = useState(false);

  const handleOpenAdminsModal = async (bot: Chatbot) => {
    setSelectedBotForAdmins(bot);
    setLoadingAdmins(true);
    setShowAddAdminForm(false);
    setEditingAdminId(null);
    clearAdminForm();
    try {
      const data = await getChatbotAdmins(bot.id);
      setAdmins(data.admins || []);
    } catch (e) {
      console.error(e);
      alert('Failed to load admins');
    } finally {
      setLoadingAdmins(false);
    }
  };

  const clearAdminForm = () => {
    setAdminName('');
    setAdminEmail('');
    setAdminPassword('');
    setCanManageKnowledge(false);
    setCanManageSystemPrompt(false);
  };

  const handleCreateOrUpdateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBotForAdmins) return;

    const payload: any = {
      name: adminName,
      email: adminEmail,
      can_manage_knowledge: canManageKnowledge,
      can_manage_system_prompt: canManageSystemPrompt,
    };
    if (adminPassword) payload.password = adminPassword;

    try {
      if (editingAdminId) {
        await updateChatbotAdmin(selectedBotForAdmins.id, editingAdminId, payload);
      } else {
        if (!adminPassword) {
          alert('Password is required for new admins');
          return;
        }
        await createChatbotAdmin(selectedBotForAdmins.id, payload);
      }
      // Reload admins
      const data = await getChatbotAdmins(selectedBotForAdmins.id);
      setAdmins(data.admins || []);
      setShowAddAdminForm(false);
      setEditingAdminId(null);
      clearAdminForm();
    } catch (e) {
      console.error(e);
      alert('Operation failed: ' + (e instanceof Error ? e.message : 'Unknown error'));
    }
  };

  const handleEditAdmin = (admin: any) => {
    setEditingAdminId(admin.id);
    setAdminName(admin.name);
    setAdminEmail(admin.email);
    setAdminPassword('');
    setCanManageKnowledge(admin.can_manage_knowledge);
    setCanManageSystemPrompt(admin.can_manage_system_prompt);
    setShowAddAdminForm(true);
  };

  const handleDeleteAdmin = async (adminId: number) => {
    if (!selectedBotForAdmins || !confirm('Are you sure you want to delete this admin?')) return;
    try {
      await deleteChatbotAdmin(selectedBotForAdmins.id, adminId);
      setAdmins((prev) => prev.filter((a) => a.id !== adminId));
    } catch (e) {
      console.error(e);
      alert('Delete failed');
    }
  };

  useEffect(() => {
    Promise.all([getChatbots(), getCredits()])
      .then(([cb, cr]) => {
        setChatbots(cb.chatbots || []);
        setCredits(cr);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="page-header flex-between">
        <div>
          <h1>Dashboard</h1>
          <p>Welcome back, <strong>{business?.name}</strong> 👋</p>
        </div>
        <button id="logout-btn" className="btn btn-ghost btn-sm" onClick={logout}>
          🚪 Logout
        </button>
      </div>

      {/* Stats */}
      {credits && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          <div className="stat-card">
            <div className="stat-icon purple">🤖</div>
            <div>
              <div className="stat-value">{chatbots.length}</div>
              <div className="stat-label">Active Chatbots</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon cyan">💬</div>
            <div>
              <div className="stat-value">{credits.activeMessagesCount}</div>
              <div className="stat-label">Message Credits</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon green">📊</div>
            <div>
              <div className="stat-value" style={{ textTransform: 'capitalize' }}>{credits.plan}</div>
              <div className="stat-label">Current Plan</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon amber">🔢</div>
            <div>
              <div className="stat-value">{credits.totalChatbots}</div>
              <div className="stat-label">Chatbot Limit</div>
            </div>
          </div>
        </div>
      )}

      {/* Chatbots */}
      <h2 className="mb-4">My Chatbots</h2>

      {loading ? (
        <div className="loading-center"><div className="spinner" /> Loading chatbots...</div>
      ) : chatbots.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🤖</div>
          <p>No chatbots yet. Create one via the API.</p>
        </div>
      ) : (
        <div className="card-grid">
          {chatbots.map((bot) => (
            <div key={bot.id} className="chatbot-card">
              <div className="chatbot-card-header">
                <div className="chatbot-avatar">
                  {roleEmoji[bot.bot_role] || '🤖'}
                </div>
                <div>
                  <div className="chatbot-name">{bot.name}</div>
                  <div className="chatbot-type">ID: {bot.id}</div>
                </div>
              </div>

              <div style={{ marginBottom: '0.75rem' }}>
                <span className={`chatbot-badge badge-telegram`}>{bot.type}</span>
                <span className={`chatbot-badge ${roleColors[bot.bot_role] || 'badge-custom'}`}>
                  {bot.bot_role}
                </span>
              </div>

              <div className="chatbot-actions" style={{ flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                  <button
                    id={`knowledge-btn-${bot.id}`}
                    className="btn btn-ghost btn-sm"
                    style={{ flex: 1 }}
                    onClick={() => navigate(`/chatbot/${bot.id}/knowledge`)}
                  >
                    📚 Knowledge
                  </button>
                  <button
                    id={`admins-btn-${bot.id}`}
                    className="btn btn-ghost btn-sm"
                    style={{ flex: 1 }}
                    onClick={() => handleOpenAdminsModal(bot)}
                  >
                    👥 Admins
                  </button>
                </div>
                <button
                  id={`messages-btn-${bot.id}`}
                  className="btn btn-primary btn-sm"
                  style={{ width: '100%' }}
                  onClick={() => navigate(`/chatbot/${bot.id}/messages`)}
                >
                  💬 Messages
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Chatbot Admins Modal */}
      {selectedBotForAdmins && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>👥 Chatbot Admins: {selectedBotForAdmins.name}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelectedBotForAdmins(null)}>✕</button>
            </div>
            <div className="modal-body">
              {loadingAdmins ? (
                <div style={{ padding: '2rem', textAlign: 'center' }}><div className="spinner" /> Loading admins...</div>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h4 style={{ margin: 0 }}>Admins ({admins.length})</h4>
                    {!showAddAdminForm && (
                      <button className="btn btn-primary btn-xs" onClick={() => { clearAdminForm(); setEditingAdminId(null); setShowAddAdminForm(true); }}>
                        ＋ Add Admin
                      </button>
                    )}
                  </div>

                  {showAddAdminForm ? (
                    <form onSubmit={handleCreateOrUpdateAdmin} style={{ border: '1px solid var(--border)', borderRadius: '6px', padding: '1rem', marginBottom: '1.5rem', background: 'rgba(255,255,255,0.01)' }}>
                      <h4 style={{ marginTop: 0, marginBottom: '0.75rem' }}>{editingAdminId ? '📝 Edit Admin' : '＋ Add New Admin'}</h4>
                      <div className="form-group mb-4">
                        <label>Name</label>
                        <input className="form-control" type="text" required value={adminName} onChange={(e) => setAdminName(e.target.value)} />
                      </div>
                      <div className="form-group mb-4">
                        <label>Email</label>
                        <input className="form-control" type="email" required value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} />
                      </div>
                      <div className="form-group mb-4">
                        <label>Password {editingAdminId && '(leave blank to keep unchanged)'}</label>
                        <input className="form-control" type="password" required={!editingAdminId} value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} />
                      </div>

                      <div className="mb-4">
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: '0.5rem' }}>
                          <input type="checkbox" checked={canManageKnowledge} onChange={(e) => setCanManageKnowledge(e.target.checked)} />
                          <span>Allow Knowledge Base CRUD</span>
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                          <input type="checkbox" checked={canManageSystemPrompt} onChange={(e) => setCanManageSystemPrompt(e.target.checked)} />
                          <span>Allow Editing System Prompt</span>
                        </label>
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setShowAddAdminForm(false); setEditingAdminId(null); }}>Cancel</button>
                        <button type="submit" className="btn btn-primary btn-sm">{editingAdminId ? 'Save Updates' : 'Create Admin'}</button>
                      </div>
                    </form>
                  ) : null}

                  {admins.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)' }}>No admins registered for this bot yet.</div>
                  ) : (
                    <div>
                      {admins.map((admin) => (
                        <div key={admin.id} className="admin-list-item">
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{admin.name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>{admin.email}</div>
                            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                              {admin.is_standalone ? (
                                <span className="chatbot-badge badge-custom" style={{ fontSize: '0.65rem' }}>Standalone</span>
                              ) : (
                                <>
                                  {admin.can_manage_knowledge && <span className="chatbot-badge badge-sales" style={{ fontSize: '0.65rem' }}>KB CRUD</span>}
                                  {admin.can_manage_system_prompt && <span className="chatbot-badge badge-faq" style={{ fontSize: '0.65rem' }}>Prompt Edit</span>}
                                </>
                              )}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '0.25rem' }}>
                            {!admin.is_standalone && (
                              <>
                                <button className="btn btn-ghost btn-xs" onClick={() => handleEditAdmin(admin)}>Edit</button>
                                <button className="btn btn-ghost btn-xs" style={{ color: 'var(--accent-red)' }} onClick={() => handleDeleteAdmin(admin.id)}>Delete</button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
