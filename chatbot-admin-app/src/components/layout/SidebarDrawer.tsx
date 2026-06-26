import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useChatbot } from '../../contexts/ChatbotContext';
import { updateChatbot } from '../../api/client';

interface SidebarDrawerProps {
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
}

export const SidebarDrawer: React.FC<SidebarDrawerProps> = ({ drawerOpen, setDrawerOpen }) => {
  const { profile, logout } = useAuth();
  const { chatbot, credits, businessPlanInfo, setChatbot } = useChatbot();

  const [editName, setEditName] = useState(chatbot?.name || '');
  const [editDesc, setEditDesc] = useState(chatbot?.description || '');
  const [saving, setSaving] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  React.useEffect(() => {
    if (chatbot) {
      setEditName(chatbot.name);
      setEditDesc(chatbot.description || '');
    }
  }, [chatbot]);

  const handleSave = async () => {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      const data = await updateChatbot(editName, editDesc);
      if (data.success && data.chatbot) {
        setChatbot(data.chatbot);
        setShowEdit(false);
        alert('Saved!');
      }
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div
        className={`drawer-overlay ${drawerOpen ? 'open' : ''}`}
        onClick={() => setDrawerOpen(false)}
      />
      <div className={`drawer ${drawerOpen ? 'open' : ''}`}>
        <div className="drawer-header">
          <h3>Profile & Settings</h3>
          <button className="drawer-close" onClick={() => setDrawerOpen(false)}>✕</button>
        </div>

        <div className="drawer-content">
          {/* Credits */}
          <div className="credits-row">
            <span className="credits-label">⚡ Message Credits</span>
            <span className="credits-value">{credits}</span>
          </div>

          {/* Topup ID */}
          {businessPlanInfo?.topup_id && (
            <div className="topup-pill" style={{ margin: '10px 16px' }}>
              <div className="topup-pill-label">Top-up ID (Reseller ကိုပေး)</div>
              <div className="topup-pill-value">{businessPlanInfo.topup_id}</div>
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
          <button className="btn btn-danger" onClick={logout} style={{ fontSize: '0.9rem' }}>
            Logout
          </button>
        </div>
      </div>
    </>
  );
};
