import React, { useState } from 'react';
import { useChatbot } from '../../../contexts/ChatbotContext';
import { createChatbot } from '../../../api/client';
import { TokenHelpModal } from './TokenHelpModal';

interface CreateBotModalProps {
  onClose: () => void;
}

export const CreateBotModal: React.FC<CreateBotModalProps> = ({ onClose }) => {
  const { setChatbot } = useChatbot();

  const [name, setName] = useState('');
  const [token, setToken] = useState('');
  const [type, setType] = useState<'telegram' | 'facebook'>('telegram');
  const [role, setRole] = useState<'sales' | 'faq' | 'support' | 'custom'>('sales');
  const [showToken, setShowToken] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [showHelp, setShowHelp] = useState(false);

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
    } finally { setCreating(false); }
  };

  return (
    <>
      <div className="modal-overlay">
        <div className="modal">
          <div className="modal-handle" />
          <div className="modal-header">
            <h2>🤖 Connect Your Bot</h2>
          </div>
          <div className="modal-body">
            {error && <div className="alert-box alert-error" style={{ marginBottom: 16 }}>⚠️ {error}</div>}

            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>Bot Name</label>
                <input
                  type="text"
                  placeholder="e.g. My Shop Assistant"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Platform</label>
                <select value={type} onChange={e => setType(e.target.value as any)}>
                  <option value="telegram">Telegram</option>
                  <option value="facebook" disabled>Facebook (Coming Soon)</option>
                </select>
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                  <label style={{ marginBottom: 0 }}>Bot Token</label>
                  <button
                    type="button"
                    onClick={() => setShowHelp(true)}
                    style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}
                  >
                    How to get? →
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showToken ? 'text' : 'password'}
                    placeholder="1234567890:ABCdef..."
                    value={token}
                    onChange={e => setToken(e.target.value)}
                    required
                    style={{ paddingRight: 52 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(v => !v)}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.78rem', fontFamily: 'inherit' }}
                  >
                    {showToken ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>Primary Role</label>
                <select value={role} onChange={e => setRole(e.target.value as any)}>
                  <option value="sales">🛒 Sales & Product Inquiry</option>
                  <option value="faq">❓ General FAQ</option>
                  <option value="support">🎧 Customer Support</option>
                  <option value="custom">✏️ Custom (Define later)</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={creating} style={{ flex: 1 }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={creating} style={{ flex: 2 }}>
                  {creating ? <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Connecting...</> : '🔗 Connect Bot'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      {showHelp && <TokenHelpModal onClose={() => setShowHelp(false)} />}
    </>
  );
};
