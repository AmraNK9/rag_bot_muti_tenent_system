import React, { useState, useEffect } from 'react';
import { useChatbot } from '../../../contexts/ChatbotContext';
import { getSystemPrompt, updateSystemPrompt } from '../../../api/client';

export const SystemPromptTab: React.FC = () => {
  const { chatbot } = useChatbot();
  const [customPrompt, setCustomPrompt] = useState('');
  const [activePrompt, setActivePrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getSystemPrompt();
      setCustomPrompt(data.customSystemPrompt || '');
      setActivePrompt(data.activePrompt || '');
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (chatbot) load(); }, [chatbot]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSystemPrompt(customPrompt);
      alert('✅ System prompt updated!');
      load();
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Update failed');
    } finally { setSaving(false); }
  };

  return (
    <div className="tab-pane">
      <div className="tab-pane-header">
        <h2>System Prompt</h2>
        <p>AI Bot ၏ Character နှင့် Behavior ကို ဤနေရာမှ သတ်မှတ်ပါ</p>
      </div>

      <div className="section-card">
        <div className="section-label">Custom Prompt</div>
        <div className="section-card-inner">
          {loading ? (
            <div className="loading-row"><div className="spinner" /></div>
          ) : (
            <>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <textarea
                  rows={8}
                  placeholder={`e.g. You are a helpful sales assistant for [Shop Name].\nAlways respond in Burmese.\nBe friendly and concise.\nDo not discuss unrelated topics.`}
                  value={customPrompt}
                  onChange={e => setCustomPrompt(e.target.value)}
                  style={{ fontFamily: 'inherit', fontSize: '0.88rem', lineHeight: 1.6, resize: 'vertical' }}
                />
              </div>

              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Saving...</> : '💾 Save Prompt'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Preview toggle */}
      {activePrompt && (
        <div style={{ padding: '12px 14px 0' }}>
          <button
            className="btn btn-secondary btn-sm"
            style={{ width: '100%' }}
            onClick={() => setShowPreview(v => !v)}
          >
            {showPreview ? '▲ Hide Active Prompt' : '▼ View Active Prompt'}
          </button>

          {showPreview && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
                Currently Active
              </div>
              <div className="prompt-preview">{activePrompt}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
