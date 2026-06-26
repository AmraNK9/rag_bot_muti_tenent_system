import React, { useState, useEffect, useRef } from 'react';
import { useChatbot } from '../../../contexts/ChatbotContext';
import type { Conversation, Message } from '../../../types';
import { getConversations, getMessages, replyToConversation } from '../../../api/client';

export const ChatsTab: React.FC = () => {
  const { chatbot } = useChatbot();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingConvs, setLoadingConvs] = useState(false);
  const [activeSender, setActiveSender] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const loadMessages = async (senderId: string) => {
    setLoadingMsgs(true);
    try {
      const data = await getMessages(senderId, 100, 0);
      setMessages(data.messages || []);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMsgs(false);
    }
  };

  useEffect(() => {
    if (chatbot) loadConversations();
  }, [chatbot]);

  // Poll for new messages
  useEffect(() => {
    if (!activeSender) return;
    const interval = setInterval(async () => {
      try {
        const data = await getMessages(activeSender, 100, 0);
        if (data.messages?.length !== messages.length) {
          setMessages(data.messages || []);
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
        }
      } catch (_) {}
    }, 4000);
    return () => clearInterval(interval);
  }, [activeSender, messages.length]);

  const openChat = (senderId: string) => {
    setActiveSender(senderId);
    loadMessages(senderId);
  };

  const closeChat = () => {
    setActiveSender(null);
    setMessages([]);
    setReplyText('');
  };

  const handleSend = async () => {
    if (!replyText.trim() || !activeSender || sendingReply) return;
    setSendingReply(true);
    const text = replyText;
    setReplyText('');
    try {
      await replyToConversation(activeSender, text);
      loadMessages(activeSender);
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Failed to send');
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
    if (d.toDateString() === today.toDateString()) return 'Today';
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="chats-view">
      {/* Conversation list */}
      <div className="conv-list-view">
        <div className="conv-list-header">
          <h2>Conversations</h2>
        </div>

        {loadingConvs ? (
          <div className="loading-row"><div className="spinner" /> Loading...</div>
        ) : conversations.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">💬</div>
            <h3>No conversations yet</h3>
            <p>When users message your bot, they will appear here.</p>
          </div>
        ) : (
          conversations.map(c => (
            <div
              key={c.sender_id}
              className="conv-item"
              onClick={() => openChat(c.sender_id)}
            >
              <div className="conv-avatar">👤</div>
              <div className="conv-info">
                <div className="conv-name">User {c.sender_id}</div>
                <div className="conv-preview">{c.message_count} messages</div>
              </div>
              <div className="conv-right">
                <span className="conv-time">{formatDate(c.last_message_at)}</span>
                <span className="conv-badge">{c.message_count}</span>
              </div>
            </div>
          ))
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
              <div className="chat-header-name">User {activeSender}</div>
              <div className="chat-header-status">● Active</div>
            </div>
          </div>

          <div className="chat-messages">
            {loadingMsgs ? (
              <div className="loading-row"><div className="spinner" /></div>
            ) : (
              (() => {
                let lastDate = '';
                return messages.map(m => {
                  const msgDate = formatDate(m.sent_date);
                  const showDate = msgDate !== lastDate;
                  lastDate = msgDate;
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

          <div className="chat-input-area">
            <input
              ref={inputRef}
              className="chat-input-field"
              type="text"
              placeholder="Reply as admin..."
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
        </div>
      )}
    </div>
  );
};
