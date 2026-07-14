import React, { useState, useEffect } from 'react';
import { SystemBotFaq } from '../../../types';
import {
  getSystemBotConfig,
  updateSystemBotConfig,
  getSystemBotFaqs,
  createSystemBotFaq,
  updateSystemBotFaq,
  deleteSystemBotFaq,
} from '../../../api/client';

export const SystemBotTab: React.FC = () => {
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  const [botName, setBotName] = useState('');
  const [botToken, setBotToken] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [isActive, setIsActive] = useState(true);

  const [faqs, setFaqs] = useState<SystemBotFaq[]>([]);
  const [loadingFaqs, setLoadingFaqs] = useState(false);
  const [editingFaq, setEditingFaq] = useState<SystemBotFaq | null>(null);
  const [creatingFaq, setCreatingFaq] = useState(false);

  const [faqQuestion, setFaqQuestion] = useState('');
  const [faqAnswer, setFaqAnswer] = useState('');
  const [faqCategory, setFaqCategory] = useState('general');
  const [faqIsActive, setFaqIsActive] = useState(true);
  const [savingFaq, setSavingFaq] = useState(false);

  const loadData = async () => {
    setLoadingConfig(true);
    setLoadingFaqs(true);
    try {
      const configRes = await getSystemBotConfig();
      if (configRes.success && configRes.config) {
        setBotName(configRes.config.bot_name);
        setBotToken(configRes.config.bot_token);
        setSystemPrompt(configRes.config.system_prompt);
        setIsActive(configRes.config.is_active);
      }

      const faqsRes = await getSystemBotFaqs();
      if (faqsRes.success && faqsRes.faqs) {
        setFaqs(faqsRes.faqs);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingConfig(false);
      setLoadingFaqs(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      const res = await updateSystemBotConfig({
        bot_name: botName,
        bot_token: botToken,
        system_prompt: systemPrompt,
        is_active: isActive,
      });
      if (res.success) {
        alert('Core Bot configuration updated successfully!');
      }
    } catch (err) {
      alert('Failed to save bot configuration.');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleOpenCreateFaq = () => {
    setEditingFaq(null);
    setCreatingFaq(true);
    setFaqQuestion('');
    setFaqAnswer('');
    setFaqCategory('general');
    setFaqIsActive(true);
  };

  const handleOpenEditFaq = (faq: SystemBotFaq) => {
    setCreatingFaq(false);
    setEditingFaq(faq);
    setFaqQuestion(faq.question);
    setFaqAnswer(faq.answer);
    setFaqCategory(faq.category || 'general');
    setFaqIsActive(faq.is_active);
  };

  const handleSaveFaqSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingFaq(true);
    try {
      if (creatingFaq) {
        const res = await createSystemBotFaq({
          question: faqQuestion,
          answer: faqAnswer,
          category: faqCategory,
          is_active: faqIsActive,
        });
        if (res.success) alert('FAQ created successfully!');
      } else if (editingFaq) {
        const res = await updateSystemBotFaq(editingFaq.id, {
          question: faqQuestion,
          answer: faqAnswer,
          category: faqCategory,
          is_active: faqIsActive,
        });
        if (res.success) alert('FAQ updated successfully!');
      }

      setEditingFaq(null);
      setCreatingFaq(false);
      const reload = await getSystemBotFaqs();
      if (reload.success) setFaqs(reload.faqs || []);
    } catch (err) {
      alert('Failed to save FAQ.');
    } finally {
      setSavingFaq(false);
    }
  };

  const handleDeleteFaq = async (id: number) => {
    if (!confirm('Are you sure you want to delete this FAQ entry?')) return;
    try {
      const res = await deleteSystemBotFaq(id);
      if (res.success) {
        alert('FAQ entry deleted.');
        setFaqs((prev) => prev.filter((f) => f.id !== id));
      }
    } catch (e) {
      alert('Failed to delete FAQ.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* BOT CONFIGURATION CARD */}
      <div className="card">
        <h2>🤖 System Core Telegram Bot Settings</h2>
        <p style={{ marginBottom: '16px', color: 'var(--text-muted)' }}>
          Configure the main Telegram Sales & Support Bot token, AI assistant persona, and active state.
        </p>

        {loadingConfig ? (
          <div className="loading-state">
            <div className="spinner" /> Loading bot configuration...
          </div>
        ) : (
          <form onSubmit={handleSaveConfig}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div className="form-group">
                <label>Bot Name</label>
                <input
                  className="form-control"
                  type="text"
                  required
                  value={botName}
                  onChange={(e) => setBotName(e.target.value)}
                  placeholder="e.g. SaaS Platform Assistant"
                />
              </div>
              <div className="form-group">
                <label>Telegram Bot Token (from @BotFather)</label>
                <input
                  className="form-control"
                  type="text"
                  required
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  placeholder="123456789:ABCdef..."
                />
              </div>
            </div>

            <div className="form-group">
              <label>AI System Prompt / Assistant Guidelines</label>
              <textarea
                className="form-control"
                rows={4}
                required
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="Instructions for how the bot should answer customer queries..."
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input
                  type="checkbox"
                  id="bot-active"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                />
                <label htmlFor="bot-active" style={{ cursor: 'pointer', fontSize: '0.875rem' }}>
                  Core Bot Active (Respond to updates & send reseller notifications)
                </label>
              </div>

              <button className="btn btn-primary" style={{ width: 'auto' }} type="submit" disabled={savingConfig}>
                {savingConfig ? 'Saving...' : 'Save Bot Config'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* FAQS MANAGER CARD */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h2 style={{ margin: 0 }}>💡 Core Bot Knowledge & FAQs</h2>
            <p style={{ margin: 0 }}>Manage Q&A pairs for automated sales assistance and instant responses.</p>
          </div>
          <button className="btn btn-primary btn-sm" onClick={handleOpenCreateFaq}>
            + Add New FAQ
          </button>
        </div>

        {loadingFaqs ? (
          <div className="loading-state">
            <div className="spinner" /> Loading FAQs...
          </div>
        ) : faqs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">💡</div>
            <p>No FAQs registered yet.</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Question</th>
                  <th>Answer Preview</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {faqs.map((faq) => (
                  <tr key={faq.id}>
                    <td>
                      <span className="badge badge-purple" style={{ textTransform: 'capitalize' }}>
                        {faq.category || 'general'}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600, maxWidth: '220px' }}>{faq.question}</td>
                    <td style={{ color: 'var(--text-muted)', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {faq.answer}
                    </td>
                    <td>
                      {faq.is_active ? (
                        <span className="badge badge-green">Active</span>
                      ) : (
                        <span className="badge badge-red">Inactive</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleOpenEditFaq(faq)}>
                          Edit
                        </button>
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--error)' }} onClick={() => handleDeleteFaq(faq.id)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE/EDIT FAQ MODAL */}
      {(editingFaq || creatingFaq) && (
        <div className="modal-overlay" onClick={() => { setEditingFaq(null); setCreatingFaq(false); }}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => { setEditingFaq(null); setCreatingFaq(false); }}>
              ×
            </button>
            <h3 style={{ marginBottom: '4px' }}>
              {creatingFaq ? 'Add New FAQ Entry' : 'Edit FAQ Entry'}
            </h3>
            <p style={{ marginBottom: '20px', fontSize: '0.8rem' }}>
              Define standard customer questions and automated answers.
            </p>

            <form onSubmit={handleSaveFaqSubmit}>
              <div className="form-group">
                <label>Category</label>
                <select className="form-control" value={faqCategory} onChange={(e) => setFaqCategory(e.target.value)}>
                  <option value="general">General</option>
                  <option value="pricing">Pricing & Plans</option>
                  <option value="reseller">Reseller Info</option>
                  <option value="technical">Technical & Features</option>
                </select>
              </div>

              <div className="form-group">
                <label>Question</label>
                <input
                  className="form-control"
                  type="text"
                  required
                  value={faqQuestion}
                  onChange={(e) => setFaqQuestion(e.target.value)}
                  placeholder="e.g. What plans do you offer?"
                />
              </div>

              <div className="form-group">
                <label>Answer</label>
                <textarea
                  className="form-control"
                  rows={4}
                  required
                  value={faqAnswer}
                  onChange={(e) => setFaqAnswer(e.target.value)}
                  placeholder="Detailed answer text..."
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', margin: '16px 0' }}>
                <input
                  type="checkbox"
                  id="faq-active"
                  checked={faqIsActive}
                  onChange={(e) => setFaqIsActive(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                />
                <label htmlFor="faq-active" style={{ cursor: 'pointer', fontSize: '0.875rem' }}>
                  Active FAQ (Used by AI Assistant)
                </label>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
                <button
                  className="btn btn-ghost"
                  style={{ flex: 1 }}
                  type="button"
                  onClick={() => { setEditingFaq(null); setCreatingFaq(false); }}
                >
                  Cancel
                </button>
                <button className="btn btn-primary" style={{ flex: 1 }} type="submit" disabled={savingFaq}>
                  {savingFaq ? 'Saving...' : 'Save FAQ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
