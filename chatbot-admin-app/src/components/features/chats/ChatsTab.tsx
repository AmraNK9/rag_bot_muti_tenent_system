import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useChatbot } from '../../../contexts/ChatbotContext';
import { useToast } from '../../../contexts/ToastContext';
import { Search, MoreVertical, Send, MessageSquare, Bot, User } from 'lucide-react';
import type { Conversation, Message } from '../../../types';
import { getConversations, getMessages, getMessagesSince, replyToConversation } from '../../../api/client';
import {
  getCachedMessages,
  getMaxCachedId,
  getCachedCount,
  cacheMessages,
  cacheSingleMessage,
  getOlderCachedMessages,
} from '../../../services/messageCache';

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

  // Guarantee scroll runs AFTER React has completely painted the messages to the screen
  const scrollToBottom = useCallback((behavior: 'auto' | 'smooth' = 'auto') => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior });
      });
    });
  }, []);

  const CONV_CACHE_KEY = 'chatbot_conversations_cache';

  const sortConversations = (list: Conversation[]) =>
    [...list].sort((a, b) => {
      if (a.sender_id === 'system') return -1;
      if (b.sender_id === 'system') return 1;
      return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
    });

  const loadConversations = useCallback(async (silent = false) => {
    // Step 1: Show cached conversations instantly
    if (!silent) {
      try {
        const cached = localStorage.getItem(CONV_CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached) as Conversation[];
          setConversations(sortConversations(parsed));
        }
      } catch {}
      setLoadingConvs(true);
    }

    // Step 2: Background API sync
    try {
      const data = await getConversations();
      const rawList: Conversation[] = data.conversations || [];
      const sorted = sortConversations(rawList);
      setConversations(sorted);
      // Update cache for next app open
      localStorage.setItem(CONV_CACHE_KEY, JSON.stringify(rawList));
    } catch (e) {
      console.error(e);
    } finally {
      if (!silent) setLoadingConvs(false);
    }
  }, []);

  // Track which chats have been background-synced during this connected session
  const syncedSendersRef = useRef<Set<string>>(new Set());

  /**
   * Cache-First message loading with Smart Silent Sync
   *
   * - Cache exists → display instantly (0 latency)
   * - Then, do a SILENT background delta sync *only once* per active connection
   * - If user exits and re-enters chat while connected, API is NOT called again
   */
  const loadMessages = useCallback(async (senderId: string) => {
    setLoadingMsgs(true);
    try {
      const cached = await getCachedMessages(senderId, 50);
      const cachedTotal = await getCachedCount(senderId);

      if (cached.length > 0) {
        // Cache hit — instant display (zero latency)
        setMessages(cached);
        // We don't know the true server total from cache alone, so we allow infinite scroll
        // to eventually hit the API by setting totalMessages to Infinity. 
        // The API fallback in loadMoreMessages will correct this with the true total.
        setTotalMessages(Infinity);

        // Smart Silent Sync: only sync if we haven't synced this chat yet in this session
        if (!syncedSendersRef.current.has(senderId)) {
          const maxId = await getMaxCachedId(senderId);
          try {
            const deltaData = await getMessagesSince(senderId, maxId);
            const newMsgs: Message[] = deltaData.messages || [];
            if (newMsgs.length > 0) {
              await cacheMessages(newMsgs);
              const sorted = [...newMsgs].reverse();
              setMessages(prev => {
                const existingIds = new Set(prev.map(m => m.id));
                const unique = sorted.filter(m => !existingIds.has(m.id));
                return [...prev, ...unique];
              });
              scrollToBottom('smooth');
            }
            // Mark as synced for this session so we don't call API again if user re-enters
            if (socket?.connected) {
              syncedSendersRef.current.add(senderId);
            }
          } catch (syncErr) {
            console.warn('[SilentSync] Background sync failed:', syncErr);
          }
        }
      } else {
        // Cache miss — first-ever open, full fetch from API
        const data = await getMessages(senderId, 50, 0);
        const rawMsgs: Message[] = data.messages || [];
        setMessages([...rawMsgs].reverse());
        setTotalMessages(data.total || 0);
        await cacheMessages(rawMsgs);
        if (socket?.connected) {
          syncedSendersRef.current.add(senderId);
        }
      }

      // Locally clear unread badge (no API call)
      setConversations(prev =>
        prev.map(c => c.sender_id === senderId ? { ...c, unread_count: 0 } : c)
      );
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMsgs(false);
    }
  }, [socket]);

  // Track scroll height before prepending older messages so we can anchor perfectly
  const scrollAdjustmentRef = useRef<number | null>(null);

  /**
   * Infinite scroll up — load older messages
   * Try cache first, then fall back to API
   */
  const loadMoreMessages = async () => {
    if (!activeSender || loadingMore || messages.length >= totalMessages) return;
    setLoadingMore(true);
    const container = chatMessagesRef.current;

    try {
      if (container) {
        scrollAdjustmentRef.current = container.scrollHeight;
      }

      const oldestDisplayedId = messages.length > 0 ? messages[0].id : Infinity;
      const olderCached = await getOlderCachedMessages(activeSender, oldestDisplayedId, 50);

      if (olderCached.length > 0) {
        setMessages(prev => [...olderCached, ...prev]);
      } else {
        const data = await getMessages(activeSender, 50, messages.length);
        const olderMessages = (data.messages || []).reverse();
        setMessages(prev => [...olderMessages, ...prev]);
        setTotalMessages(data.total || 0);
        await cacheMessages(data.messages || []);
      }
    } catch (e) {
      console.error('Failed to load older messages:', e);
    } finally {
      setLoadingMore(false);
    }
  };

  // Synchronously adjust scroll position right AFTER DOM updates but BEFORE browser paints
  // This guarantees absolutely 0 flicker when older messages are prepended.
  useLayoutEffect(() => {
    if (scrollAdjustmentRef.current !== null && chatMessagesRef.current) {
      const container = chatMessagesRef.current;
      const heightIncrease = container.scrollHeight - scrollAdjustmentRef.current;
      container.scrollTop += heightIncrease;
      scrollAdjustmentRef.current = null;
    }
  }, [messages]);

  const handleScroll = () => {
    const container = chatMessagesRef.current;
    // Use a small threshold (e.g. < 5) instead of strictly === 0, as mobile devices
    // with bounce scrolling or fractional pixels might never hit exactly 0.
    if (container && container.scrollTop < 5 && messages.length < totalMessages && !loadingMore && !loadingMsgs) {
      loadMoreMessages();
    }
  };

  useEffect(() => {
    if (chatbot) loadConversations();
  }, [chatbot, loadConversations]);

  // WebSocket: real-time messages + app-level reconnect sync
  useEffect(() => {
    if (!socket) return;

    // Real-time message handler
    const handleNewMessage = (msg: any) => {
      // 1. Cache immediately
      cacheSingleMessage(msg).catch(err => console.warn('[Cache] Failed to cache socket message:', err));

      // 2. Update conversation list locally (preview + badge + sort)
      setConversations(prev => {
        const exists = prev.find(c => c.sender_id === msg.sender_id);
        if (exists) {
          const updated = prev.map(c =>
            c.sender_id === msg.sender_id
              ? {
                  ...c,
                  last_message: msg.message,
                  last_sender_type: msg.sender_type,
                  last_reply_source: msg.reply_source,
                  last_message_at: msg.sent_date,
                  // If this chat is currently open, don't increment unread
                  unread_count: activeSender === msg.sender_id ? 0 : Number(c.unread_count || 0) + 1,
                }
              : c
          );
          const sorted = sortConversations(updated);
          // Persist to localStorage for next app open
          try { localStorage.setItem(CONV_CACHE_KEY, JSON.stringify(sorted)); } catch {}
          return sorted;
        }
        return prev;
      });

      // 3. If the message belongs to the active conversation, append in real-time
      if (activeSender && String(msg.sender_id) === String(activeSender)) {
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          const newMsgs = [...prev, msg];
          scrollToBottom('smooth');
          return newMsgs;
        });
      }
    };

    // App-level reconnect sync: when WebSocket reconnects after a disconnect,
    // delta-sync all cached conversations to fill any gaps
    const handleReconnect = async () => {
      console.log('[Socket] Reconnected — running app-level delta sync');
      
      // Clear the synced memory so next chat entry forces a gap-fill sync
      syncedSendersRef.current.clear();
      
      loadConversations(true);

      // Sync messages for the active conversation if any
      if (activeSender) {
        try {
          const maxId = await getMaxCachedId(activeSender);
          if (maxId > 0) {
            const deltaData = await getMessagesSince(activeSender, maxId);
            const newMsgs: Message[] = deltaData.messages || [];
            if (newMsgs.length > 0) {
              await cacheMessages(newMsgs);
              const sorted = [...newMsgs].reverse();
              setMessages(prev => {
                const existingIds = new Set(prev.map(m => m.id));
                const unique = sorted.filter(m => !existingIds.has(m.id));
                return [...prev, ...unique];
              });
              scrollToBottom('smooth');
            }
          }
        } catch (err) {
          console.warn('[DeltaSync] Reconnect sync failed:', err);
        }
      }
    };

    socket.on('new_message', handleNewMessage);
    socket.io.on('reconnect', handleReconnect);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.io.off('reconnect', handleReconnect);
    };
  }, [socket, activeSender, loadConversations]);

  const shouldScrollToBottomRef = useRef(false);

  // Scroll to bottom reliably on initial load when loading is done
  useLayoutEffect(() => {
    if (shouldScrollToBottomRef.current && !loadingMsgs && messages.length > 0) {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
      }
      shouldScrollToBottomRef.current = false;
    }
  }, [loadingMsgs, messages]);

  const openChat = (senderId: string) => {
    setActiveSender(senderId);
    shouldScrollToBottomRef.current = true;
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
          scrollToBottom('smooth');
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
                        {c.last_sender_type === 'bot' ? (
                          <span style={{ opacity: 0.7, display: 'inline-flex', alignItems: 'center', gap: 4, marginRight: 4 }}>
                            {c.last_reply_source === 'ai' ? (
                              <><Bot size={13} /> {t('bot')}: </>
                            ) : (
                              <><User size={13} /> {t('you')}: </>
                            )}
                          </span>
                        ) : null}
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
