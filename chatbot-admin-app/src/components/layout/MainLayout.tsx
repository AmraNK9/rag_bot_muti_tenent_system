import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useChatbot } from '../../contexts/ChatbotContext';
import { SidebarDrawer } from './SidebarDrawer';
import { ChatsTab } from '../features/chats/ChatsTab';
import { KnowledgeTab } from '../features/knowledge/KnowledgeTab';
import { SystemPromptTab } from '../features/prompt/SystemPromptTab';
import { BillingTab } from '../features/billing/BillingTab';
import { CreateBotModal } from '../features/chatbot/CreateBotModal';

type TabId = 'chats' | 'knowledge' | 'prompt' | 'billing';

export const MainLayout: React.FC = () => {
  const { profile } = useAuth();
  const { chatbot, credits } = useChatbot();

  const [activeTab, setActiveTab] = useState<TabId>('chats');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showCreateBotModal, setShowCreateBotModal] = useState(false);

  const tabs = [
    { id: 'chats' as TabId, label: 'Chats', icon: '💬' },
    ...(profile?.canManageKnowledge ? [{ id: 'knowledge' as TabId, label: 'Knowledge', icon: '📚' }] : []),
    ...(profile?.canManageSystemPrompt ? [{ id: 'prompt' as TabId, label: 'Prompt', icon: '⚙️' }] : []),
    { id: 'billing' as TabId, label: 'Billing', icon: '💳' },
  ];

  return (
    <div className="app-container">
      {/* TOP BAR */}
      <nav className="top-nav">
        <div className="nav-brand">
          <span className="brand-icon">🤖</span>
          <span className="brand-name">{chatbot ? chatbot.name : 'Bot Admin'}</span>
          <div className="nav-credits">
            ⚡ {credits}
          </div>
        </div>



        <div className="nav-profile" onClick={() => setDrawerOpen(true)}>
          <div className="profile-avatar">{profile?.name?.charAt(0).toUpperCase() || 'U'}</div>
        </div>
      </nav>

      <SidebarDrawer drawerOpen={drawerOpen} setDrawerOpen={setDrawerOpen} />

      {/* CONTENT */}
      <main className="main-content">
        {!chatbot ? (
          <div className="empty-state" style={{ height: '100%' }}>
            <div className="empty-icon">🔌</div>
            <h3>Connect Your First Bot</h3>
            <p>ပထမဆုံး AI Chatbot ကို ချိတ်ဆက်ပြီး Customer တွေကို ၂၄နာရီ အလိုအလျောက် ဖြေဆိုနိုင်ပါပြီ။</p>
            <button className="btn btn-primary" style={{ maxWidth: 240 }} onClick={() => setShowCreateBotModal(true)}>
              ➕ Create My First Bot
            </button>
          </div>
        ) : (
          <>
            {activeTab === 'chats' && <ChatsTab />}
            {activeTab === 'knowledge' && profile?.canManageKnowledge && <KnowledgeTab />}
            {activeTab === 'prompt' && profile?.canManageSystemPrompt && <SystemPromptTab />}
            {activeTab === 'billing' && <BillingTab />}
          </>
        )}
      </main>

      {/* BOTTOM NAV */}
      <nav className="bottom-nav">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="nav-icon">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </nav>

      {showCreateBotModal && <CreateBotModal onClose={() => setShowCreateBotModal(false)} />}
    </div>
  );
};
