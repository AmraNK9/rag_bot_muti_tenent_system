import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useChatbot } from '../../contexts/ChatbotContext';
import { SidebarDrawer } from './SidebarDrawer';
import { ChatsTab } from '../features/chats/ChatsTab';
import { SmartItemsTab } from '../features/smart-items/SmartItemsTab';
import { SystemPromptTab } from '../features/prompt/SystemPromptTab';
import { BillingTab } from '../features/billing/BillingTab';
import { CreateBotModal } from '../features/chatbot/CreateBotModal';
import { Bot, Zap, Menu, MessageSquare, BookOpen, SlidersHorizontal, Unplug } from 'lucide-react';

type TabId = 'chats' | 'knowledge' | 'prompt' | 'billing';

export const MainLayout: React.FC = () => {
  const { t: tc } = useTranslation('common');
  const { profile } = useAuth();
  const { chatbot, credits } = useChatbot();

  const [activeTab, setActiveTab] = useState<TabId>('chats');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showCreateBotModal, setShowCreateBotModal] = useState(false);

  // Exclude billing from bottom tab bar
  const tabs = [
    { id: 'chats' as TabId, label: tc('nav.chats', 'Chats'), icon: <MessageSquare size={20} /> },
    ...(profile?.canManageKnowledge ? [{ id: 'knowledge' as TabId, label: tc('nav.smartItems', 'Smart Items'), icon: <BookOpen size={20} /> }] : []),
    ...(profile?.canManageSystemPrompt ? [{ id: 'prompt' as TabId, label: tc('nav.prompt', 'Prompt'), icon: <SlidersHorizontal size={20} /> }] : []),
  ];

  return (
    <div className="app-container">
      {/* TOP BAR */}
      <nav className="top-nav">
        <div className="nav-brand">
          <span className="brand-icon" style={{ display: 'flex', alignItems: 'center' }}><Bot size={22} color="var(--primary)" /></span>
          <span className="brand-name">{chatbot ? chatbot.name : tc('layout.botAdmin', 'Bot Admin')}</span>
          <div 
            className="nav-credits clickable-credits" 
            onClick={() => setActiveTab('billing')}
            title="View Billing & Buy Credits"
            style={{ display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <Zap size={14} fill="currentColor" /> {credits}
          </div>
        </div>

        <div className="nav-profile" onClick={() => setDrawerOpen(true)} style={{ background: 'transparent', border: 'none', padding: 8, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          <Menu size={24} color="var(--text-main)" />
        </div>
      </nav>

      <SidebarDrawer 
        drawerOpen={drawerOpen} 
        setDrawerOpen={setDrawerOpen} 
        onSelectBilling={() => setActiveTab('billing')}
      />

      {/* CONTENT */}
      <main className="main-content">
        {activeTab === 'billing' ? (
          <BillingTab />
        ) : !chatbot ? (
          <div className="empty-state" style={{ height: '100%' }}>
            <div className="empty-icon" style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}><Unplug size={48} color="var(--text-muted)" /></div>
            <h3>{tc('layout.emptyBotTitle')}</h3>
            <p>{tc('layout.emptyBotDesc')}</p>
            <button className="btn btn-primary" style={{ maxWidth: 240 }} onClick={() => setShowCreateBotModal(true)}>
              {tc('layout.createBotBtn')}
            </button>
          </div>
        ) : (
          <>
            {activeTab === 'chats' && <ChatsTab />}
            {activeTab === 'knowledge' && profile?.canManageKnowledge && <SmartItemsTab />}
            {activeTab === 'prompt' && profile?.canManageSystemPrompt && <SystemPromptTab />}
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
