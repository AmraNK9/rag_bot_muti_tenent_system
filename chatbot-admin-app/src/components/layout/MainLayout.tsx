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
import { InAppTour } from '../features/tour/InAppTour';
import { Zap, Menu, MessageSquare, BookOpen, Unplug, X, BellRing, Send, ListTodo } from 'lucide-react';
import { getSystemBotInfo } from '../../api/client';

import { ChevronLeft } from 'lucide-react';

type TabId = 'chats' | 'actions' | 'knowledge';

export const MainLayout: React.FC = () => {
  const { t: tc } = useTranslation('common');
  const { profile } = useAuth();
  const { chatbot, credits, businessPlanInfo } = useChatbot();

  const [activeTab, setActiveTab] = useState<TabId>('chats');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showCreateBotModal, setShowCreateBotModal] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isBillingOpen, setIsBillingOpen] = useState(false);

  const [systemBotUsername, setSystemBotUsername] = useState('YourBotUsername');
  const [showNotiBanner, setShowNotiBanner] = useState(true);
  const [actionCount, setActionCount] = useState(0);

  React.useEffect(() => {
    if (chatbot && businessPlanInfo?.telegram_chat_id == null) {
      getSystemBotInfo()
        .then((res) => {
          if (res.success && res.username) {
            setSystemBotUsername(res.username);
          }
        })
        .catch(() => {});
    }
  }, [chatbot, businessPlanInfo?.telegram_chat_id]);

  // Exclude billing from bottom tab bar
  const tabs = [
    { id: 'chats' as TabId, label: tc('nav.chats', 'Chats'), icon: <MessageSquare size={20} /> },
    { 
      id: 'actions' as TabId, 
      label: tc('nav.actions', 'Actions'), 
      icon: (
        <div style={{ position: 'relative' }}>
          <ListTodo size={20} />
          {actionCount > 0 && (
            <span style={{
              position: 'absolute', top: -4, right: -6, background: 'var(--red)', color: 'white',
              fontSize: '10px', fontWeight: 'bold', padding: '2px 5px', borderRadius: '10px',
              border: '1px solid var(--bg-surface)'
            }}>
              {actionCount}
            </span>
          )}
        </div>
      )
    },
    { id: 'knowledge' as TabId, label: tc('nav.smartItems', 'Smart Items'), icon: <BookOpen size={20} /> }
  ];

  return (
    <div className="app-container">
      {/* TOP BAR */}
      <nav className="top-nav">
        <div className="nav-brand">
          <span className="brand-icon" style={{ display: 'flex', alignItems: 'center' }}><img src="/logo.png" alt="Logo" style={{ width: 34, height: 34, objectFit: 'contain', transform: 'scale(1.2)' }} /></span>
          <span className="brand-name">{chatbot ? chatbot.name : tc('layout.botAdmin', 'Bot Admin')}</span>
          <div 
            className={`nav-credits ${profile?.isStandalone ? 'clickable-credits' : ''}`} 
            onClick={() => profile?.isStandalone && setIsBillingOpen(true)}
            title={profile?.isStandalone ? tc('layout.viewBilling') : tc('layout.availableCredits')}
            style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: profile?.isStandalone ? 'pointer' : 'default' }}
          >
            <Zap size={14} fill="currentColor" /> {credits}
          </div>
        </div>

        <div id="tour-settings-btn" className="nav-profile" onClick={() => setDrawerOpen(true)} style={{ background: 'transparent', border: 'none', padding: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', position: 'relative' }}>
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
        onOpenBilling={() => { setIsSettingsOpen(false); setIsBillingOpen(true); }}
      />

      <InAppTour />

      {isSettingsOpen && <SettingsScreen onClose={() => setIsSettingsOpen(false)} />}
      
      {isBillingOpen && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 1000, background: 'var(--bg-page)', display: 'flex', flexDirection: 'column', animation: 'fadeInUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}>
          <div style={{ height: 'var(--nav-h)', display: 'flex', alignItems: 'center', padding: '0 16px', background: 'var(--bg-glass)', backdropFilter: 'blur(20px)', borderBottom: '1px solid var(--border)', flexShrink: 0, zIndex: 2 }}>
            <button onClick={() => setIsBillingOpen(false)} style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--primary)', fontWeight: 600, fontSize: '1rem', cursor: 'pointer' }}>
              <ChevronLeft size={20} /> {tc('settings.back')}
            </button>
            <div style={{ flex: 1, textAlign: 'center', fontWeight: 700, fontSize: '1.05rem', paddingRight: 60 }}>
              {tc('settings.billingTitle', 'Billing & Subscription')}
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <BillingTab />
          </div>
        </div>
      )}

      {/* CONTENT */}
      <main className="main-content">
        {!chatbot && !showCreateBotModal && (
          <div className="empty-state" style={{ height: '100%' }}>
            <div className="empty-icon" style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}><Unplug size={48} color="var(--text-muted)" /></div>
            <h3>{tc('layout.noBotTitle')}</h3>
            <p>{tc('layout.noBotDesc')}</p>
            <button className="btn btn-primary" style={{ maxWidth: 240 }} onClick={() => setShowCreateBotModal(true)}>
              {tc('layout.createBotBtn', 'Create Bot')}
            </button>
          </div>
        )}

        {chatbot && (
          <>

            <div style={{ display: (activeTab === 'chats' || activeTab === 'actions') ? 'flex' : 'none', flexDirection: 'column', height: '100%', minHeight: 0 }}>
              <ChatsTab currentTab={activeTab} onActionCountChange={setActionCount} />
            </div>
            <div style={{ display: activeTab === 'knowledge' ? 'flex' : 'none', flexDirection: 'column', height: '100%', minHeight: 0 }}>
              <SmartItemsTab />
            </div>
          </>
        )}
      </main>

      {chatbot && businessPlanInfo?.telegram_chat_id == null && showNotiBanner && (
        <div style={{ margin: '0 16px 16px', padding: '12px 16px', background: 'var(--bg-surface)', borderRadius: 'var(--radius)', border: '1px solid var(--primary)', boxShadow: '0 4px 16px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', gap: 12, position: 'relative', animation: 'fadeInUp 0.4s ease-out', zIndex: 10 }}>
          <button onClick={() => setShowNotiBanner(false)} style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: 4 }}>
            <X size={16} />
          </button>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ background: 'var(--primary)', color: '#fff', padding: 8, borderRadius: '50%', flexShrink: 0, marginTop: 2 }}>
              <BellRing size={20} />
            </div>
            <div>
              <h4 style={{ margin: '0 0 4px', fontSize: '0.95rem', color: 'var(--primary)', paddingRight: 24 }}>{tc('settings.telegramNudgeTitle')}</h4>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-main)', lineHeight: 1.4 }}>
                {tc('settings.telegramNudgeDesc')}
              </p>
            </div>
          </div>
          {businessPlanInfo?.id && (
            <a
              href={`https://t.me/${systemBotUsername}?start=connect_business_${businessPlanInfo.id}`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-primary btn-sm"
              style={{ alignSelf: 'flex-start', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, padding: '6px 16px' }}
              onClick={() => setShowNotiBanner(false)}
            >
              <Send size={16} /> {tc('settings.connectTelegram')}
            </a>
          )}
        </div>
      )}

      {/* BOTTOM NAV */}
      <nav className="bottom-nav">
        {tabs.map(tab => (
          <button
            key={tab.id}
            id={`tour-${tab.id}-tab`}
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
