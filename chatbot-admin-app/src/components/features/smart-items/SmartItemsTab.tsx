import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useChatbot } from '../../../contexts/ChatbotContext';
import { useToast } from '../../../contexts/ToastContext';
import type { SmartItem } from '../../../types';
import { getSmartItems, deleteSmartItem } from '../../../api/client';
import { SmartItemFormModal } from './SmartItemFormModal';
import { LayoutGrid, Package, MessageSquare, Plus, Search, CircleDollarSign, Pencil, Trash2 } from 'lucide-react';

// Unique accent colour per item id for visual variety
function hashColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 65%, 45%)`;
}

type FilterType = 'all' | 'product' | 'info';

export const SmartItemsTab: React.FC = () => {
  const { chatbot } = useChatbot();
  const { showToast } = useToast();
  const { t } = useTranslation('smartItems');
  const { t: tc } = useTranslation('common');

  const [allItems, setAllItems] = useState<SmartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<SmartItem | undefined>(undefined);
  const [deletingId, setDeletingId] = useState<string | number | null>(null);

  // Filter + Search state
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [searchInput, setSearchInput] = useState('');

  // Pro-level Client-Side Filtering: fetch ALL items once.
  const loadItems = async () => {
    if (!chatbot) return;
    setLoading(true);
    try {
      // Fetch up to 1000 items at once without any filters
      const data = await getSmartItems(1000, 0);
      setAllItems(data.items || []);
    } catch (e) {
      console.error(e);
      setAllItems([]);
    } finally {
      setLoading(false);
    }
  };

  // Only fetch from API when the component first mounts or chatbot changes
  useEffect(() => {
    if (chatbot) loadItems();
  }, [chatbot]);

  // Derived state: instantly filter items in memory based on local state (0-latency)
  const filteredItems = allItems.filter(item => {
    // 1. Filter by category
    if (filterType !== 'all' && item.item_type !== filterType) return false;
    
    // 2. Filter by search input
    if (searchInput) {
      const q = searchInput.toLowerCase();
      const matchesTitle = item.title.toLowerCase().includes(q);
      const matchesContent = item.content.toLowerCase().includes(q);
      if (!matchesTitle && !matchesContent) return false;
    }
    
    return true;
  });

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

  const TABS: { key: FilterType; label: string; icon: React.ReactNode } = [
    { key: 'all', label: t('filterAll'), icon: <LayoutGrid size={14} /> },
    { key: 'product', label: t('filterProduct'), icon: <Package size={14} /> },
    { key: 'info', label: t('filterInfo'), icon: <MessageSquare size={14} /> },
  ];

  return (
    <div className="tab-pane">
      {/* Header row */}
      <div className="tab-pane-header--row">
        <div className="tab-pane-title">
          <h2>{t('title')}</h2>
          <p>{t('subtitle')}</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openNewItemModal} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Plus size={16} /> {t('addBtn')}
        </button>
      </div>

      {/* ── Filter Bar: Tabs + Search ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 16,
        flexWrap: 'wrap',
      }}>
        {/* Category Tabs */}
        <div style={{
          display: 'flex',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          overflow: 'hidden',
          flexShrink: 0,
        }}>
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilterType(tab.key)}
              style={{
                padding: '7px 14px',
                border: 'none',
                background: filterType === tab.key
                  ? 'rgba(10, 132, 255, 0.18)'
                  : 'transparent',
                color: filterType === tab.key ? 'var(--primary)' : 'var(--text-muted)',
                fontFamily: 'inherit',
                fontSize: '0.82rem',
                fontWeight: filterType === tab.key ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.18s ease',
                borderRight: '1px solid var(--border)',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div style={{ flex: 1, minWidth: 180, position: 'relative' }}>
          <span style={{
            position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--text-muted)', pointerEvents: 'none', display: 'flex', alignItems: 'center'
          }}><Search size={16} /></span>
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder={t('searchPlaceholder')}
            style={{
              width: '100%',
              paddingLeft: 32,
              paddingRight: searchInput ? 32 : 12,
              paddingTop: 7,
              paddingBottom: 7,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text)',
              fontFamily: 'inherit',
              fontSize: '0.85rem',
              boxSizing: 'border-box',
            }}
          />
          {searchInput && (
            <button
              onClick={() => { setSearchInput(''); setSearchQuery(''); }}
              style={{
                position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', color: 'var(--text-muted)',
                cursor: 'pointer', fontSize: '0.9rem', lineHeight: 1, padding: 2,
              }}
            >×</button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="loading-row"><div className="spinner" /> {tc('loading')}</div>
      ) : filteredItems.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon" style={{ display: 'flex', justifyContent: 'center', marginBottom: 16, color: 'var(--text-muted)' }}>
            {searchInput || filterType !== 'all' ? <Search size={48} /> : <Package size={48} />}
          </div>
          <h3>{searchInput || filterType !== 'all' ? t('noResults') : t('emptyTitle')}</h3>
          {!searchInput && filterType === 'all' && (
            <>
              <p>{t('emptyDesc')}</p>
              <button className="btn btn-primary" style={{ maxWidth: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={openNewItemModal}>
                <Plus size={16} /> {t('addFirstBtn')}
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="section-card">
          <div className="section-label">{t('itemCount', { count: filteredItems.length })}</div>

          {filteredItems.map(item => {
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
                    <span className={`badge ${isProduct ? 'badge-blue' : 'badge-gray'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {isProduct ? <Package size={12} /> : <MessageSquare size={12} />} {isProduct ? t('type.product') : t('type.info')}
                    </span>
                    {isProduct && item.price != null && (
                      <span className="smart-item-meta-val" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <CircleDollarSign size={12} color="var(--text-muted)" /> {item.price}
                      </span>
                    )}
                    {isProduct && item.stock_count != null && (
                      <span className="smart-item-meta-val" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Package size={12} color={item.stock_count === 0 ? 'var(--red)' : 'var(--text-muted)'} />
                        <span style={{ color: item.stock_count === 0 ? 'var(--red)' : 'var(--text-muted)' }}>
                          {item.stock_count === 0
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
                    style={{ padding: '6px 11px', display: 'flex', alignItems: 'center' }}
                    title={tc('edit')}
                  ><Pencil size={14} /></button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDelete(item.id, item.title)}
                    disabled={deletingId === item.id}
                    style={{ padding: '6px 11px', display: 'flex', alignItems: 'center' }}
                    title={tc('delete')}
                  >{deletingId === item.id ? '…' : <Trash2 size={14} />}</button>
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




