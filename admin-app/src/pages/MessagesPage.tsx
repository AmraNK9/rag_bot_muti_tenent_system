import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getConversations, getMessages } from '../api/client';

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

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getInitials(senderId: string) {
  return senderId.slice(-2).toUpperCase();
}

export default function MessagesPage() {
  const { chatbotId } = useParams<{ chatbotId: string }>();
  const navigate = useNavigate();
  const id = Number(chatbotId);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedSender, setSelectedSender] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [totalMsgs, setTotalMsgs] = useState(0);

  useEffect(() => {
    getConversations(id)
      .then((data) => setConversations(data.conversations || []))
      .catch(console.error)
      .finally(() => setLoadingConvs(false));
  }, [id]);

  const loadMessages = useCallback(async (senderId: string) => {
    setLoadingMsgs(true);
    setMessages([]);
    try {
      const data = await getMessages(id, senderId, 100, 0);
      setMessages(data.messages || []);
      setTotalMsgs(data.total || 0);
    } catch (e) { console.error(e); }
    finally { setLoadingMsgs(false); }
  }, [id]);

  const handleSelectSender = (senderId: string) => {
    setSelectedSender(senderId);
    loadMessages(senderId);
  };

  return (
    <div>
      <div className="flex-between mb-6">
        <div>
          <button className="btn btn-ghost btn-sm mb-4" onClick={() => navigate('/')} id="back-to-dashboard-msgs">
            ← Back
          </button>
          <h1>💬 Conversations</h1>
          <p>Chatbot #{chatbotId} · {conversations.length} unique users</p>
        </div>
      </div>

      <div className="conversations-layout">
        {/* Sidebar: User List */}
        <div className="conv-sidebar">
          <div className="conv-sidebar-title">Users ({conversations.length})</div>
          {loadingConvs ? (
            <div className="loading-center" style={{ padding: '2rem 0.5rem' }}>
              <div className="spinner" />
            </div>
          ) : conversations.length === 0 ? (
            <div style={{ padding: '1.5rem 0.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No conversations yet
            </div>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.sender_id}
                id={`conv-${conv.sender_id}`}
                className={`conv-item ${selectedSender === conv.sender_id ? 'selected' : ''}`}
                onClick={() => handleSelectSender(conv.sender_id)}
              >
                <div className="conv-avatar">{getInitials(conv.sender_id)}</div>
                <div className="conv-info">
                  <div className="conv-sender-id">{conv.sender_id}</div>
                  <div className="conv-last-time">{formatDate(conv.last_message_at)}</div>
                </div>
                <div className="conv-count">{conv.message_count}</div>
              </div>
            ))
          )}
        </div>

        {/* Chat Panel */}
        <div className="chat-panel">
          {!selectedSender ? (
            <div className="chat-empty">
              <div className="chat-empty-icon">💬</div>
              <p>Select a user to view conversation</p>
            </div>
          ) : (
            <>
              <div className="chat-panel-header">
                <div className="conv-avatar" style={{ width: '36px', height: '36px' }}>
                  {getInitials(selectedSender)}
                </div>
                <div>
                  <div className="chat-panel-title">User: {selectedSender}</div>
                  <div className="chat-panel-sub">{totalMsgs} messages total</div>
                </div>
              </div>

              <div className="chat-messages" id="chat-messages-panel">
                {loadingMsgs ? (
                  <div className="loading-center"><div className="spinner" /> Loading messages...</div>
                ) : messages.length === 0 ? (
                  <div className="chat-empty">
                    <div className="chat-empty-icon">📭</div>
                    <p>No messages found</p>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div key={msg.id} className={`msg-row ${msg.sender_type}`}>
                      <div className={`msg-avatar ${msg.sender_type}`}>
                        {msg.sender_type === 'bot' ? '🤖' : getInitials(msg.sender_id)}
                      </div>
                      <div>
                        <div className={`msg-bubble ${msg.sender_type}`}>
                          {msg.message}
                        </div>
                        <div className={`msg-time`} style={{ textAlign: msg.sender_type === 'user' ? 'right' : 'left' }}>
                          {formatTime(msg.sent_date)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
