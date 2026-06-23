import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getKnowledgeChunks, deleteChunk, clearKnowledge, ingestDocument } from '../api/client';

interface Chunk {
  id: string;
  collection: string;
  text: string;
  metadata: Record<string, any>;
}

const PAGE_SIZE = 15;

export default function KnowledgePage() {
  const { chatbotId } = useParams<{ chatbotId: string }>();
  const navigate = useNavigate();
  const id = Number(chatbotId);

  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);

  // Ingest form
  const [docText, setDocText] = useState('');
  const [ingesting, setIngesting] = useState(false);
  const [ingestMsg, setIngestMsg] = useState('');

  // Confirm dialog
  const [confirmTarget, setConfirmTarget] = useState<'chunk' | 'all' | null>(null);
  const [confirmDocId, setConfirmDocId] = useState('');
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getKnowledgeChunks(id, PAGE_SIZE, offset);
      setChunks(data.chunks || []);
      setTotal(data.total || 0);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [id, offset]);

  useEffect(() => { load(); }, [load]);

  const handleDeleteChunk = async () => {
    setDeleting(true);
    try {
      await deleteChunk(id, confirmDocId);
      setConfirmTarget(null);
      load();
    } catch (e) { console.error(e); }
    finally { setDeleting(false); }
  };

  const handleClearAll = async () => {
    setDeleting(true);
    try {
      await clearKnowledge(id);
      setConfirmTarget(null);
      setOffset(0);
      load();
    } catch (e) { console.error(e); }
    finally { setDeleting(false); }
  };

  const handleIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docText.trim()) return;
    setIngesting(true);
    setIngestMsg('');
    try {
      const data = await ingestDocument(id, docText);
      setIngestMsg(`✅ Ingested ${data.chunkCount} chunks successfully!`);
      setDocText('');
      setOffset(0);
      load();
    } catch (err: any) {
      setIngestMsg(`❌ ${err.response?.data?.error || 'Ingest failed'}`);
    } finally {
      setIngesting(false);
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div>
      {/* Confirm Dialog */}
      {confirmTarget && (
        <div className="confirm-overlay" onClick={() => setConfirmTarget(null)}>
          <div className="confirm-box" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-title">
              {confirmTarget === 'all' ? '⚠️ Clear All Knowledge?' : '🗑️ Delete Chunk?'}
            </div>
            <div className="confirm-desc">
              {confirmTarget === 'all'
                ? 'This will permanently delete ALL knowledge chunks for this chatbot. This cannot be undone.'
                : `Delete chunk "${confirmDocId.slice(0, 40)}..."?`}
            </div>
            <div className="confirm-actions">
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirmTarget(null)}>Cancel</button>
              <button
                className="btn btn-danger btn-sm"
                onClick={confirmTarget === 'all' ? handleClearAll : handleDeleteChunk}
                disabled={deleting}
              >
                {deleting ? <div className="spinner" /> : '🗑️ Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex-between mb-6">
        <div>
          <button className="btn btn-ghost btn-sm mb-4" onClick={() => navigate('/')} id="back-to-dashboard">
            ← Back
          </button>
          <h1>📚 Knowledge Base</h1>
          <p>Chatbot #{chatbotId} · {total} chunks stored</p>
        </div>
        <button
          id="clear-all-btn"
          className="btn btn-danger btn-sm"
          onClick={() => { setConfirmTarget('all'); setConfirmDocId(''); }}
          disabled={total === 0}
        >
          🗑️ Clear All
        </button>
      </div>

      {/* Ingest Form */}
      <div className="card mb-6">
        <h3 style={{ marginBottom: '1rem' }}>➕ Add New Knowledge</h3>
        <form onSubmit={handleIngest}>
          <div className="form-group">
            <label className="form-label">Document Text</label>
            <textarea
              id="ingest-textarea"
              className="form-textarea"
              placeholder="Paste your knowledge document here... It will be automatically chunked and embedded."
              value={docText}
              onChange={(e) => setDocText(e.target.value)}
              style={{ minHeight: '140px' }}
            />
          </div>
          {ingestMsg && (
            <div style={{
              padding: '0.65rem 1rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.875rem',
              background: ingestMsg.startsWith('✅') ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)',
              border: `1px solid ${ingestMsg.startsWith('✅') ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)'}`,
              color: ingestMsg.startsWith('✅') ? '#34d399' : '#f87171',
            }}>
              {ingestMsg}
            </div>
          )}
          <button id="ingest-btn" className="btn btn-primary" type="submit" disabled={ingesting || !docText.trim()}>
            {ingesting ? <><div className="spinner" /> Processing...</> : '🚀 Ingest Document'}
          </button>
        </form>
      </div>

      {/* Chunks List */}
      <div className="flex-between mb-4">
        <h3>Stored Chunks</h3>
        <div className="page-info">Page {currentPage} of {totalPages || 1}</div>
      </div>

      {loading ? (
        <div className="loading-center"><div className="spinner" /> Loading chunks...</div>
      ) : chunks.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📭</div>
          <p>No knowledge chunks yet. Add a document above to get started.</p>
        </div>
      ) : (
        <>
          <div className="chunk-list">
            {chunks.map((chunk, idx) => (
              <div key={chunk.id} className="chunk-item">
                <div className="chunk-index">#{offset + idx + 1}</div>
                <div style={{ flex: 1 }}>
                  <div className="chunk-text">{chunk.text}</div>
                  <div className="chunk-meta">ID: {chunk.id}</div>
                </div>
                <button
                  id={`delete-chunk-${idx}`}
                  className="btn btn-danger btn-sm"
                  style={{ flexShrink: 0 }}
                  onClick={() => { setConfirmTarget('chunk'); setConfirmDocId(chunk.id); }}
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button
                className="btn btn-ghost btn-sm"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              >← Prev</button>
              <span className="page-info">{currentPage} / {totalPages}</span>
              <button
                className="btn btn-ghost btn-sm"
                disabled={offset + PAGE_SIZE >= total}
                onClick={() => setOffset(offset + PAGE_SIZE)}
              >Next →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
