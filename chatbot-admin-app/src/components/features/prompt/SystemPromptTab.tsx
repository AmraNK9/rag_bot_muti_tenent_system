import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useChatbot } from '../../../contexts/ChatbotContext';
import { useToast } from '../../../contexts/ToastContext';
import { getSystemPrompt, updateSystemPrompt } from '../../../api/client';

export const SystemPromptTab: React.FC = () => {
  const { chatbot, loadProfileData } = useChatbot();
  const { showToast } = useToast();
  const { t } = useTranslation('prompt');
  const { t: tc } = useTranslation('common');
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getSystemPrompt();
      setPrompt(data.customSystemPrompt || '');
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (chatbot) load(); }, [chatbot]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = await updateSystemPrompt(prompt);
      if (data) {
        setHasChanges(false);
        setEditMode(false);
        showToast('success', t('toast.savedTitle'), t('toast.savedMsg'));
        loadProfileData();
      }
    } catch (e: any) {
      showToast('error', t('toast.errorTitle'), e?.response?.data?.error || tc('error.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="tab-pane">
      <div className="tab-pane-header">
        <h2>{t('title')}</h2>
        <p>{t('subtitle')}</p>
      </div>

      <div className="prompt-container" style={{ padding: '0 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>{t('currentPrompt')}</h3>
        </div>

        {editMode && (
          <div className="alert-box alert-error" style={{ fontSize: '0.82rem', marginBottom: '12px', padding: '10px 12px' }}>
            {t('previewWarning')}
          </div>
        )}

        <div className="form-group">
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <button 
              className={`btn ${editMode ? 'btn-primary' : 'btn-secondary'}`} 
              style={{ flex: 1, padding: '8px' }}
              onClick={() => setEditMode(true)}
            >
              ✏️ {t('editMode')}
            </button>
            <button 
              className={`btn ${!editMode ? 'btn-primary' : 'btn-secondary'}`} 
              style={{ flex: 1, padding: '8px' }}
              onClick={() => setEditMode(false)}
            >
              👁️ {t('previewMode')}
            </button>
          </div>

          {editMode ? (
            <textarea
              className="prompt-textarea"
              style={{ height: '240px', fontSize: '0.9rem', lineHeight: '1.6', width: '100%' }}
              value={prompt}
              onChange={e => {
                setPrompt(e.target.value);
                setHasChanges(true);
              }}
              placeholder={t('promptPlaceholder')}
              disabled={loading || saving}
            />
          ) : (
            <div className="prompt-preview" style={{ height: '240px', overflowY: 'auto', background: '#f9f9f9', padding: '12px', borderRadius: '4px' }}>
              {prompt || t('noPrompt')}
            </div>
          )}
        </div>

        {editMode && (
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving || !hasChanges}
            style={{ width: '100%', marginTop: '12px' }}
          >
            {saving ? <>{tc('saving')}...</> : t('savePrompt')}
          </button>
        )}
      </div>
    </div>
  );
};
