import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useChatbot } from '../../../contexts/ChatbotContext';
import { useToast } from '../../../contexts/ToastContext';
import type { SmartItem } from '../../../types';
import { getSmartItems, deleteSmartItem } from '../../../api/client';
import { SmartItemFormModal } from './SmartItemFormModal';

// Unique accent colour per item id for visual variety
function hashColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 65%, 45%)`;
}

export const SmartItemsTab: React.FC = () => {
  const { chatbot } = useChatbot();
  const { showToast } = useToast();
  const { t } = useTranslation('smartItems');
  const { t: tc } = useTranslation('common');

  const [items, setItems] = useState<SmartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<SmartItem | undefined>(undefined);
  const [deletingId, setDeletingId] = useState<string | number | null>(null);

  const loadItems = async () => {
    if (!chatbot) return;
    setLoading(true);
    try {
      const data = await getSmartItems(100, 0);
      setItems(data.items || []);
    } catch (e) {
      console.error(e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (chatbot) loadItems();
  }, [chatbot]);

  const handleDelete = async (id: string | number, title: string) => {
    if (!confirm(t('deleteConfirm', { title }))) return;
    setDeletingId(id);
    try {
      await deleteSmartItem(id);
      showToast('success', t('toast.deletedTitle'), t('toast.deletedMsg', { title }));
      loadItems();
    } catch (e: any) {
      showToast('error', tc('error.deleteFailed'), e?.response?.data?.error || tc('tryAgain'));
    } finally {
      setDeletingId(null);
    }
  };

  const handleEdit = (item: SmartItem) => {
    setEditingItem(item);
    setShowModal(true);
  };

  const openNewItemModal = () => {
    setEditingItem(undefined);
    setShowModal(true);
  };

  return (
    <div className="tab-pane">
      {/* Header row */}
      <div className="tab-pane-header--row">
        <div className="tab-pane-title">
          <h2>{t('title')}</h2>
          <p>{t('subtitle')}</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openNewItemModal}>
          ＋ {t('addBtn')}
        </button>
      </div>

      {loading ? (
        <div className="loading-row"><div className="spinner" /> {tc('loading')}</div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📦</div>
          <h3>{t('emptyTitle')}</h3>
          <p>{t('emptyDesc')}</p>
          <button className="btn btn-primary" style={{ maxWidth: 220 }} onClick={openNewItemModal}>
            ➕ {t('addFirstBtn')}
          </button>
        </div>
      ) : (
        <div className="section-card">
          <div className="section-label">{t('itemCount', { count: items.length })}</div>

          {items.map(item => {
            const isProduct = item.item_type === 'product';
            const accentColor = hashColor(String(item.id));
            return (
              <div key={item.id} className="smart-item-row">
                {/* Accent dot */}
                <div style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: accentColor, flexShrink: 0, marginTop: 2,
                }} />

                <div className="smart-item-info">
                  <span className="smart-item-title">{item.title}</span>
                  <div className="smart-item-meta">
                    <span className={`badge ${isProduct ? 'badge-blue' : 'badge-gray'}`}>
                      {isProduct ? `📦 ${t('type.product')}` : `💬 ${t('type.info')}`}
                    </span>
                    {isProduct && item.price != null && (
                      <span className="smart-item-meta-val">💰 {item.price}</span>
                    )}
                    {isProduct && item.stock_count != null && (
                      <span className="smart-item-meta-val">
                        <span style={{ color: item.stock_count === 0 ? 'var(--red)' : 'var(--text-muted)' }}>
                          📦 {item.stock_count === 0
                            ? tc('outOfStock')
                            : tc('inStock', { count: item.stock_count })}
                        </span>
                      </span>
                    )}
                    {isProduct && item.auto_track_stock && (
                      <span className="badge badge-green" style={{ fontSize: '0.65rem' }}>
                        {t('meta.autoTrack')}
                      </span>
                    )}
                  </div>
                </div>

                <div className="smart-item-actions">
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleEdit(item)}
                    style={{ padding: '6px 11px' }}
                    title={tc('edit')}
                  >✏️</button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDelete(item.id, item.title)}
                    disabled={deletingId === item.id}
                    style={{ padding: '6px 11px' }}
                    title={tc('delete')}
                  >{deletingId === item.id ? '…' : '🗑️'}</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <SmartItemFormModal
          onClose={() => setShowModal(false)}
          onSave={loadItems}
          existingItem={editingItem}
        />
      )}
    </div>
  );
};
