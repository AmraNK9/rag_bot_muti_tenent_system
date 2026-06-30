import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useChatbot } from '../../../contexts/ChatbotContext';
import { useToast } from '../../../contexts/ToastContext';
import type { Conversation, Message } from '../../../types';
import { getConversations, getMessages, replyToConversation } from '../../../api/client';

// Generate a unique hue per sender_id for visual variety in avatars
function hashAvatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 30%)`;
}

export const ChatsTab: React.FC = () => {
  const { chatbot, socket } = useChatbot();
  const { showToast } = useToast();
  const { t } = useTranslation('chats');
  const { t: tc } = useTranslation('common');

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingConvs, setLoadingConvs] = useState(false);
  const [activeSender, setActiveSender] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Pagination / Infinite scroll states
  const [totalMessages, setTotalMessages] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const chatMessagesRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async (silent = false) => {
    if (!silent) setLoadingConvs(true);
    try {
      const data = await getConversations();
      const rawList: Conversation[] = data.conversations || [];
      // Pin 'system' conversation to the top, sort others by latest message time DESC
      const sorted = [...rawList].sort((a, b) => {
        if (a.sender_id === 'system') return -1;
        if (b.sender_id === 'system') return 1;
        return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
      });
      setConversations(sorted);
    } catch (e) {
      console.error(e);
    } finally {
      if (!silent) setLoadingConvs(false);
    }
  }, []);

  const loadMessages = useCallback(async (senderId: string) => {
    setLoadingMsgs(true);
    try {
      const data = await getMessages(senderId, 50, 0);
      const rawMsgs = data.messages || [];
      // Backend returns DESC order, reverse it to show chronologically
      setMessages([...rawMsgs].reverse());
      setTotalMessages(data.total || 0);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'auto' }), 80);
      // Silently reload the conversation list to clear the unread badge immediately
      loadConversations(true);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMsgs(false);
    }
  }, [loadConversations]);

  const loadMoreMessages = async () => {
    if (!activeSender || loadingMore || messages.length >= totalMessages) return;
    setLoadingMore(true);
    const container = chatMessagesRef.current;
    const previousScrollHeight = container ? container.scrollHeight : 0;

    try {
      const data = await getMessages(activeSender, 50, messages.length);
      const olderMessages = (data.messages || []).reverse();
      setMessages((prev) => [...olderMessages, ...prev]);
      setTotalMessages(data.total || 0);

      // Keep scroll position relative to the loaded content
      if (container) {
        setTimeout(() => {
          container.scrollTop = container.scrollHeight - previousScrollHeight;
        }, 30);
      }
    } catch (e) {
      console.error('Failed to load older messages:', e);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleScroll = () => {
    const container = chatMessagesRef.current;
    if (container && container.scrollTop === 0 && messages.length < totalMessages && !loadingMore && !loadingMsgs) {
      loadMoreMessages();
    }
  };

  useEffect(() => {
    if (chatbot) loadConversations();
  }, [chatbot, loadConversations]);

  // Listen to incoming messages in real-time via Socket.io
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (msg: any) => {
      // 1. Refresh conversations list silently (to update previews, badges, and sorting)
      loadConversations(true);

      // 2. If the message belongs to the active conversation, append it in real-time
      if (activeSender && String(msg.sender_id) === String(activeSender)) {
        setMessages((prev) => {
          // Avoid appending duplicate messages
          if (prev.some((m) => m.id === msg.id)) return prev;
          const newMsgs = [...prev, msg];
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
          return newMsgs;
        });
      }
    };

    socket.on('new_message', handleNewMessage);
    return () => {
      socket.off('new_message', handleNewMessage);
    };
  }, [socket, activeSender, loadConversations]);

  const openChat = (senderId: string) => {
    setActiveSender(senderId);
    loadMessages(senderId);
  };

  const closeChat = () => {
    setActiveSender(null);
    setMessages([]);
    setReplyText('');
    setTotalMessages(0);
    setLoadingMore(false);
  };

  const handleSend = async () => {
    if (!replyText.trim() || !activeSender || sendingReply) return;
    setSendingReply(true);
    const text = replyText;
    setReplyText('');
    try {
      const data = await replyToConversation(activeSender, text);
      if (data.success && data.message) {
        // Append the new message immediately to the message list without triggering a full loadMessages spinner
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.message.id)) return prev;
          const newMsgs = [...prev, data.message];
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
          return newMsgs;
        });
        // Silently refresh the conversations list in the background to update the previews/badges
        loadConversations(true);
      }
    } catch (e: any) {
      showToast('error', tc('error.sendFailed'), e?.response?.data?.error || tc('tryAgain'));
      setReplyText(text);
    } finally {
      setSendingReply(false);
    }
  };

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return t('today');
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return t('yesterday');
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="chats-view">
      {/* Conversation list */}
      <div className="conv-list-view">
        <div className="conv-list-header">
          <h2>{t('title')}</h2>
        </div>

        {loadingConvs ? (
          <div className="loading-row"><div className="spinner" /> {tc('loading')}</div>
        ) : conversations.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">💬</div>
            <h3>{t('emptyTitle')}</h3>
            <p>{t('emptyDesc')}</p>
          </div>
        ) : (
          conversations.map(c => {
            const isSystem = c.sender_id === 'system';
            return (
              <div
                key={c.sender_id}
                className={`conv-item ${isSystem ? 'system-conv' : ''}`}
                onClick={() => openChat(c.sender_id)}
                style={isSystem ? { borderLeft: '4px solid var(--primary)', background: 'var(--bg-surface-2)' } : undefined}
              >
                <div
                  className="conv-avatar"
                  style={isSystem
                    ? { background: 'rgba(139, 92, 246, 0.15)', color: 'var(--primary)' }
                    : { background: hashAvatarColor(c.sender_id) }
                  }
                >
                  {isSystem ? '🛡️' : c.sender_id.charAt(0).toUpperCase()}
                </div>
                <div className="conv-info">
                  <div className="conv-name" style={isSystem ? { fontWeight: 700, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '6px' } : undefined}>
                    {isSystem ? (
                      <>
                        {t('systemTitle')}
                        <span style={{ fontSize: '0.65rem', background: 'var(--primary)', color: '#fff', padding: '1px 5px', borderRadius: '4px', fontWeight: 600 }}>📌 {t('pinned')}</span>
                      </>
                    ) : `${t('userPrefix')} ${c.sender_id}`}
                  </div>
                  <div className="conv-preview" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>
                    {isSystem ? (
                      c.last_message || t('platformMessages')
                    ) : (
                      <>
                        {c.last_sender_type === 'bot' ? <span style={{ opacity: 0.7 }}>{t('you')}: </span> : null}
                        {c.last_message || t('messagesCount', { count: c.message_count })}
                      </>
                    )}
                  </div>
                </div>
                <div className="conv-right">
                  <span className="conv-time">{formatDate(c.last_message_at)}</span>
                  {!isSystem && Number(c.unread_count) > 0 && (
                    <span className="conv-badge" style={{ background: 'var(--red)' }}>{c.unread_count}</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Full-screen chat window */}
      {activeSender && (
        <div className="chat-window-view">
          <div className="chat-header">
            <button className="chat-back-btn" onClick={closeChat}>
              ‹
            </button>
            <div className="chat-header-info">
              <div className="chat-header-name">
                {activeSender === 'system' ? `🛡️ ${t('systemTitle')}` : `${t('userPrefix')} ${activeSender}`}
              </div>
              <div className="chat-header-status">● {t('active')}</div>
            </div>
          </div>

          <div className="chat-messages" ref={chatMessagesRef} onScroll={handleScroll}>
            {loadingMore && (
              <div className="loading-row" style={{ padding: '8px 0', fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center' }}>
                <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2, marginRight: 0 }} />
                {tc('loading')}
              </div>
            )}
            {loadingMsgs ? (
              <div className="loading-row"><div className="spinner" /></div>
            ) : (
              (() => {
                let lastDate = '';
                return messages.map(m => {
                  const msgDate = formatDate(m.sent_date);
                  const showDate = msgDate !== lastDate;
                  lastDate = msgDate;
                  const isSystemMsg = m.sender_id === 'system';
                  
                  if (isSystemMsg) {
                    const isApproved = m.message.toLowerCase().includes('approved');
                    return (
                      <React.Fragment key={m.id}>
                        {showDate && <div className="msg-date-sep">{msgDate}</div>}
                        <div className="message-bubble system" style={{
                          margin: '12px auto',
                          maxWidth: '85%',
                          background: isApproved ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                          border: isApproved ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)',
                          color: isApproved ? '#10b981' : '#ef4444',
                          padding: '10px 14px',
                          borderRadius: '12px',
                          fontSize: '0.82rem',
                          textAlign: 'center',
                          lineHeight: '1.4',
                          boxShadow: 'none'
                        }}>
                          <div style={{ fontWeight: 600, marginBottom: '2px' }}>
                            {isApproved ? t('systemNotification') : t('systemAlert')}
                          </div>
                          <div>{m.message}</div>
                          <div style={{ fontSize: '0.68rem', opacity: 0.7, marginTop: '4px' }}>{formatTime(m.sent_date)}</div>
                        </div>
                      </React.Fragment>
                    );
                  }

                  return (
                    <React.Fragment key={m.id}>
                      {showDate && <div className="msg-date-sep">{msgDate}</div>}
                      <div className={`message-bubble ${m.sender_type === 'user' ? 'user' : 'bot'}`}>
                        <div className="msg-inner">{m.message}</div>
                        <div className="message-time">{formatTime(m.sent_date)}</div>
                      </div>
                    </React.Fragment>
                  );
                });
              })()
            )}
            <div ref={messagesEndRef} />
          </div>

          {activeSender === 'system' ? (
            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.86rem', borderTop: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
              {t('systemReadOnly')}
            </div>
          ) : (
            <div className="chat-input-area">
              <input
                ref={inputRef}
                className="chat-input-field"
                type="text"
                placeholder={t('replyPlaceholder')}
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                disabled={sendingReply}
              />
              <button
                className="chat-send-btn"
                onClick={handleSend}
                disabled={sendingReply || !replyText.trim()}
              >
                {sendingReply ? '·' : '↑'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
