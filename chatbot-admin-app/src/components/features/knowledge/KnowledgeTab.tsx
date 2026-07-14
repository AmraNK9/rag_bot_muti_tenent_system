import React, { useState, useEffect } from 'react';
import { useChatbot } from '../../../contexts/ChatbotContext';
import { useToast } from '../../../contexts/ToastContext';
import type { KnowledgeChunk } from '../../../types';
import { getKnowledgeChunks, ingestDocument, deleteChunk, updateChunk } from '../../../api/client';

export const KnowledgeTab: React.FC = () => {
  const { chatbot } = useChatbot();
  const { showToast } = useToast();

  const [chunks, setChunks] = useState<KnowledgeChunk[]>([]);
  const [loadingChunks, setLoadingChunks] = useState(false);
  const [ingestText, setIngestText] = useState('');
  const [ingesting, setIngesting] = useState(false);
  const [editingChunk, setEditingChunk] = useState<KnowledgeChunk | null>(null);
  const [editText, setEditText] = useState('');
  const [saving, setSaving] = useState(false);
  const [showIngestForm, setShowIngestForm] = useState(false);

  const loadKnowledge = async () => {
    setLoadingChunks(true);
    try {
      const data = await getKnowledgeChunks(100, 0);
      setChunks(data.chunks || []);
    } catch (e) { console.error(e); }
    finally { setLoadingChunks(false); }
  };

  useEffect(() => { if (chatbot) loadKnowledge(); }, [chatbot]);

  const handleIngest = async () => {
    if (!ingestText.trim() || ingesting) return;
    setIngesting(true);
    try {
      const data = await ingestDocument(ingestText.trim());
      if (data.success) {
        setIngestText('');
        setShowIngestForm(false);
        showToast('success', `${data.chunksAdded} chunks added!`, 'Knowledge ingested successfully.');
        loadKnowledge();
      }
    } catch (e: any) {
      showToast('error', 'Ingest failed', e?.response?.data?.error || 'Please try again.');
    } finally { setIngesting(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this knowledge chunk?')) return;
    try {
      await deleteChunk(id);
      setChunks(prev => prev.filter(c => c.id !== id));
    } catch (e) { showToast('error', 'Delete failed', 'Please try again.'); }
  };

  const startEdit = (c: KnowledgeChunk) => {
    setEditingChunk(c);
    setEditText(c.text);
  };

  const saveEdit = async () => {
    if (!editingChunk || !editText.trim()) return;
    setSaving(true);
    try {
      await updateChunk(editingChunk.id, editText);
      setEditingChunk(null);
      loadKnowledge();
    } catch (e: any) {
      showToast('error', 'Update failed', e?.response?.data?.error || 'Please try again.');
    } finally { setSaving(false); }
  };

  return (
    <div className="tab-pane">
      <div className="tab-pane-header">
        <h2>Knowledge Base</h2>
        <p>AI Bot သင်ကြားပေးမည့် အချက်အလက်များ စီမံပါ</p>
      </div>

      {/* Add knowledge button */}
      {!showIngestForm ? (
        <div style={{ padding: '0 14px 12px' }}>
          <button
            className="btn btn-primary btn-sm"
            style={{ width: '100%' }}
            onClick={() => setShowIngestForm(true)}
          >
            ＋ Add New Knowledge
          </button>
        </div>
      ) : (
        <div className="section-card">
          <div className="section-label">New Knowledge Entry</div>
          <div className="section-card-inner">
            <div className="form-group" style={{ marginBottom: 12 }}>
              <textarea
                rows={5}
                placeholder="Paste text, FAQs, or product info here. The AI will learn from this..."
                value={ingestText}
                onChange={e => setIngestText(e.target.value)}
                style={{ fontSize: '0.87rem', lineHeight: 1.6 }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => { setShowIngestForm(false); setIngestText(''); }}
                disabled={ingesting}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleIngest}
                disabled={ingesting || !ingestText.trim()}
                style={{ flex: 1 }}
              >
                {ingesting ? <><div className="spinner" style={{ width: 15, height: 15, borderWidth: 2 }} /> Processing...</> : 'Add Knowledge'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chunk list */}
      <div style={{ padding: '4px 14px 0' }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 }}>
          {chunks.length} Stored Chunks
        </div>
      </div>

      {loadingChunks ? (
        <div className="loading-row"><div className="spinner" /> Loading knowledge...</div>
      ) : chunks.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📚</div>
          <h3>No knowledge yet</h3>
          <p>Add text, FAQs, or product details so your AI can answer customer questions accurately.</p>
        </div>
      ) : (
        <div className="section-card">
          {chunks.map(c => (
            <div key={c.id} className="chunk-item">
              {editingChunk?.id === c.id ? (
                <div>
                  <textarea
                    rows={4}
                    value={editText}
                    onChange={e => setEditText(e.target.value)}
                    style={{ width: '100%', marginBottom: 8, fontSize: '0.87rem', lineHeight: 1.5, resize: 'none', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px', color: 'var(--text-main)', fontFamily: 'inherit', outline: 'none' }}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="chunk-btn chunk-btn-edit" onClick={() => setEditingChunk(null)} disabled={saving}>Cancel</button>
                    <button className="chunk-btn chunk-btn-edit" onClick={saveEdit} disabled={saving} style={{ flex: 1 }}>
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="chunk-text">{c.text}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      #{c.id.substring(0, 8)}
                    </span>
                    <div className="chunk-actions">
                      <button className="chunk-btn chunk-btn-edit" onClick={() => startEdit(c)}>Edit</button>
                      <button className="chunk-btn chunk-btn-delete" onClick={() => handleDelete(c.id)}>Delete</button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
