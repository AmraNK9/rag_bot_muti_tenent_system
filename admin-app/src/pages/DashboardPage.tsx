import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getChatbots, getCredits } from '../api/client';

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

              <div className="chatbot-actions">
                <button
                  id={`knowledge-btn-${bot.id}`}
                  className="btn btn-ghost btn-sm"
                  onClick={() => navigate(`/chatbot/${bot.id}/knowledge`)}
                >
                  📚 Knowledge Base
                </button>
                <button
                  id={`messages-btn-${bot.id}`}
                  className="btn btn-primary btn-sm"
                  onClick={() => navigate(`/chatbot/${bot.id}/messages`)}
                >
                  💬 Messages
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
