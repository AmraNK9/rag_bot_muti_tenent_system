import React from 'react';

interface BottomNavProps {
  activeTab: 'dashboard' | 'p2p' | 'wallet' | 'history';
  setActiveTab: (tab: 'dashboard' | 'p2p' | 'wallet' | 'history') => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, setActiveTab }) => {
  return (
    <div className="bottom-nav">
      <button
        className={`bottom-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
        onClick={() => setActiveTab('dashboard')}
      >
        <div className="bottom-nav-item-icon">📊</div>
        <div>Home</div>
      </button>
      <button
        className={`bottom-nav-item ${activeTab === 'p2p' ? 'active' : ''}`}
        onClick={() => setActiveTab('p2p')}
      >
        <div className="bottom-nav-item-icon">💎</div>
        <div>Top-Up</div>
      </button>
      <button
        className={`bottom-nav-item ${activeTab === 'wallet' ? 'active' : ''}`}
        onClick={() => setActiveTab('wallet')}
      >
        <div className="bottom-nav-item-icon">💼</div>
        <div>Wallet</div>
      </button>
      <button
        className={`bottom-nav-item ${activeTab === 'history' ? 'active' : ''}`}
        onClick={() => setActiveTab('history')}
      >
        <div className="bottom-nav-item-icon">📜</div>
        <div>History</div>
      </button>
    </div>
  );
};
