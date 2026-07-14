import React from 'react';

interface AppBarProps {
  activeTab: 'dashboard' | 'p2p' | 'wallet' | 'history';
  onMenuClick: () => void;
}

export const AppBar: React.FC<AppBarProps> = ({ activeTab, onMenuClick }) => {
  const getTitle = () => {
    switch (activeTab) {
      case 'dashboard':
        return 'Dashboard';
      case 'p2p':
        return 'Direct Top-Up';
      case 'wallet':
        return 'Wallet';
      case 'history':
        return 'History';
      default:
        return 'Reseller Portal';
    }
  };

  return (
    <div className="app-bar">
      <button className="app-bar-icon-btn" onClick={onMenuClick}>
        ☰
      </button>
      <div className="app-bar-title">{getTitle()}</div>
      <div style={{ width: '40px' }} />
    </div>
  );
};
