import React from 'react';

type TabId = 'analytics' | 'resellers' | 'requests' | 'topups' | 'plans' | 'system-bot' | 'settings' | 'logs';

interface SidebarProps {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, onLogout }) => {
  const tabs = [
    { id: 'analytics' as TabId, label: 'Analytics', icon: '📈' },
    { id: 'resellers' as TabId, label: 'Resellers', icon: '👥' },
    { id: 'requests' as TabId, label: 'Plan Upgrades', icon: '📥' },
    { id: 'topups' as TabId, label: 'Reseller Deposits', icon: '💸' },
    { id: 'plans' as TabId, label: 'Pricing Plans', icon: '💎' },
    { id: 'system-bot' as TabId, label: 'Core Bot & FAQs', icon: '🤖' },
    { id: 'settings' as TabId, label: 'Global Settings', icon: '⚙️' },
    { id: 'logs' as TabId, label: 'Audit Logs', icon: '📜' },
  ];

  return (
    <div className="sidebar">
      <div className="sidebar-brand">
        <span className="brand-icon">🛡️</span>
        <span className="brand-name">Super Admin</span>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
          >
            <span className="nav-icon">{tab.icon}</span>
            <span className="nav-label">{tab.label}</span>
          </button>
        ))}
      </nav>

      <div style={{ marginTop: 'auto', paddingTop: '20px' }}>
        <button
          className="btn btn-danger"
          style={{ width: '100%', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          onClick={onLogout}
        >
          🚪 Logout
        </button>
      </div>
    </div>
  );
};
