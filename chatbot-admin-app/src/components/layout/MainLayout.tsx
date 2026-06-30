import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useChatbot } from '../../contexts/ChatbotContext';
import { SidebarDrawer } from './SidebarDrawer';
import { SettingsScreen } from '../features/settings/SettingsScreen';
import { ChatsTab } from '../features/chats/ChatsTab';
import { SmartItemsTab } from '../features/smart-items/SmartItemsTab';
import { BillingTab } from '../features/billing/BillingTab';
import { CreateBotModal } from '../features/chatbot/CreateBotModal';
import { Bot, Zap, Menu, MessageSquare, BookOpen, Unplug } from 'lucide-react';

type TabId = 'chats' | 'knowledge' | 'billing';

export const MainLayout: React.FC = () => {
  const { t: tc } = useTranslation('common');
  const { profile } = useAuth();
  const { chatbot, credits, businessPlanInfo } = useChatbot();

  const [activeTab, setActiveTab] = useState<TabId>('chats');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showCreateBotModal, setShowCreateBotModal] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const isTelegramConnected = chatbot?.telegram_username != null || profile?.email === 'demo@user.com'; // Adjust logic based on context or use businessPlanInfo if available here. Wait, MainLayout has `chatbot`, but not `businessPlanInfo`. Let's just use `useChatbot().businessPlanInfo` to check. 

  // Exclude billing from bottom tab bar
  const tabs = [
    { id: 'chats' as TabId, label: tc('nav.chats', 'Chats'), icon: <MessageSquare size={20} /> },
    ...(profile?.canManageKnowledge ? [{ id: 'knowledge' as TabId, label: tc('nav.smartItems', 'Smart Items'), icon: <BookOpen size={20} /> }] : []),
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

        <div className="nav-profile" onClick={() => setDrawerOpen(true)} style={{ background: 'transparent', border: 'none', padding: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', position: 'relative' }}>
          <Menu size={24} color="var(--text-main)" />
          {businessPlanInfo?.telegram_chat_id == null && (
            <span style={{ position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: '50%', background: 'var(--red)', border: '2px solid var(--bg-glass)' }} />
          )}
        </div>
      </nav>

      <SidebarDrawer 
        drawerOpen={drawerOpen} 
        setDrawerOpen={setDrawerOpen} 
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {isSettingsOpen && <SettingsScreen onClose={() => setIsSettingsOpen(false)} />}

      {/* CONTENT */}
      <main className="main-content">
        {!chatbot && !showCreateBotModal && activeTab !== 'billing' && (
          <div className="empty-state" style={{ height: '100%' }}>
            <div className="empty-icon" style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}><Unplug size={48} color="var(--text-muted)" /></div>
            <h3>{tc('layout.noBotTitle', 'No Chatbot Selected')}</h3>
            <p>{tc('layout.noBotDesc', 'Create your first AI assistant to get started.')}</p>
            <button className="btn btn-primary" style={{ maxWidth: 240 }} onClick={() => setShowCreateBotModal(true)}>
              {tc('layout.createBotBtn', 'Create Bot')}
            </button>
          </div>
        )}

        {chatbot && activeTab === 'chats' && <ChatsTab />}
        {chatbot && activeTab === 'knowledge' && profile?.canManageKnowledge && <SmartItemsTab />}
        {activeTab === 'billing' && <BillingTab />}
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
