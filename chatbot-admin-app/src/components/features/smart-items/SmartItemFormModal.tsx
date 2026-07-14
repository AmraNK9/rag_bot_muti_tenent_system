import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../contexts/ToastContext';
import type { SmartItem } from '../../../types';
import { createSmartItem, updateSmartItem } from '../../../api/client';

interface Props {
  onClose: () => void;
  onSave: () => void;
  existingItem?: SmartItem;
}

export const SmartItemFormModal: React.FC<Props> = ({ onClose, onSave, existingItem }) => {
  const { t } = useTranslation('smartItems');
  const { t: tc } = useTranslation('common');
  const { showToast } = useToast();

  const [itemType, setItemType] = useState<'product' | 'info'>(existingItem?.item_type || 'product');
  const [title, setTitle] = useState(existingItem?.title || '');
  const [content, setContent] = useState(existingItem?.content || '');
  const [price, setPrice] = useState<string>(existingItem?.price?.toString() || '');
  const [saving, setSaving] = useState(false);

  // Clear product-only fields when switching to 'info'
  useEffect(() => {
    if (itemType === 'info') {
      setPrice('');
    }
  }, [itemType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      showToast('warning', t('toast.titleRequired'));
      return;
    }
    if (!content.trim()) {
      showToast('warning', t('toast.contentRequired'));
      return;
    }

    setSaving(true);
    const payload = {
      item_type: itemType,
      title: title.trim(),
      content: content.trim(),
      price: itemType === 'product' && price !== '' ? parseFloat(price) : null,
      stock_count: null,
      auto_track_stock: false,
    };

    try {
      if (existingItem) {
        await updateSmartItem(existingItem.id, payload);
        showToast('success', t('toast.updatedTitle'), t('toast.updatedMsg', { title: title.trim() }));
      } else {
        await createSmartItem(payload);
        showToast('success', t('toast.addedTitle'), t('toast.addedMsg', { title: title.trim() }));
      }
      onSave();
      onClose();
    } catch (err: any) {
      showToast('error', tc('error.saveFailed'), err?.response?.data?.error || tc('tryAgain'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content">
        <div className="modal-handle" />

        {/* Header */}
        <div className="modal-header">
          <h3>{existingItem ? t('form.editTitle') : t('form.addTitle')}</h3>
          <button className="btn-icon" onClick={onClose} aria-label={tc('close')}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ padding: '16px 20px' }}>

            {/* ── Type Selector (styled toggle buttons) ── */}
            <div className="form-group" style={{ marginBottom: 20 }}>
              <label>{t('form.typeLabel')}</label>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                {(['product', 'info'] as const).map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setItemType(type)}
                    style={{
                      flex: 1,
                      padding: '10px 8px',
                      borderRadius: 'var(--radius-sm)',
                      border: `1.5px solid ${itemType === type ? 'var(--primary)' : 'var(--border)'}`,
                      background: itemType === type ? 'rgba(10, 132, 255, 0.1)' : 'rgba(255,255,255,0.04)',
                      color: itemType === type ? 'var(--primary)' : 'var(--text-muted)',
                      fontFamily: 'inherit',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {type === 'product' ? t('form.physicalProduct') : t('form.infoFaq')}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Title ── */}
            <div className="form-group">
              <label>{itemType === 'product' ? t('form.productName') : t('form.topicQuestion')}</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder={itemType === 'product' ? t('form.productNamePlaceholder') : t('form.topicPlaceholder')}
                required
              />
            </div>

            {/* ── Content ── */}
            <div className="form-group">
              <label>{itemType === 'product' ? t('form.description') : t('form.detailsAnswer')}</label>
              <textarea
                rows={4}
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder={itemType === 'product' ? t('form.descriptionPlaceholder') : t('form.answerPlaceholder')}
                required
                style={{ resize: 'none' }}
              />
            </div>

            {/* ── Product-only fields ── */}
            {itemType === 'product' && (
              <div style={{ animation: 'fadeInUp 0.2s ease' }}>
                <div style={{ display: 'flex', gap: 10 }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>{t('form.price')}</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={price}
                      onChange={e => setPrice(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Footer ── */}
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={saving}>
              {tc('cancel')}
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
              {saving
                ? <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> {tc('saving')}</>
                : existingItem ? t('form.saveChanges') : t('form.addItem')
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
