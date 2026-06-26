import React, { useState } from 'react';

interface TokenHelpModalProps {
  onClose: () => void;
}

export const TokenHelpModal: React.FC<TokenHelpModalProps> = ({ onClose }) => {
  const [tokenHelpTab, setTokenHelpTab] = useState(1);

  return (
    <div className="modal-overlay" style={{ zIndex: 2000 }}>
      <div className="modal" style={{ maxWidth: '600px' }}>
        <h2 style={{ marginTop: 0, marginBottom: '20px' }}>How to get Telegram Bot Token</h2>
        
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
          <button className={`btn ${tokenHelpTab === 1 ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTokenHelpTab(1)}>Step 1: BotFather</button>
          <button className={`btn ${tokenHelpTab === 2 ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTokenHelpTab(2)}>Step 2: Create</button>
          <button className={`btn ${tokenHelpTab === 3 ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTokenHelpTab(3)}>Step 3: Copy</button>
        </div>

        <div style={{ minHeight: '150px' }}>
          {tokenHelpTab === 1 && (
            <div>
              <p>1. Open Telegram app on your phone or desktop.</p>
              <p>2. Search for <strong>@BotFather</strong> and open the chat. Ensure it has the blue verification tick.</p>
              <p>3. Tap or type <strong>/start</strong>.</p>
            </div>
          )}
          {tokenHelpTab === 2 && (
            <div>
              <p>1. Send the command <strong>/newbot</strong> to BotFather.</p>
              <p>2. Choose a display name for your bot (e.g., "My Shop Bot").</p>
              <p>3. Choose a unique username ending in "bot" (e.g., "myshop_bot").</p>
            </div>
          )}
          {tokenHelpTab === 3 && (
            <div>
              <p>1. BotFather will send a success message containing the <strong>HTTP API Token</strong>.</p>
              <p>2. It looks like: <code>1234567890:ABCdefGhI_jklMNOpqrSTuvwXYZ</code>.</p>
              <p>3. Copy this token and paste it into the "Bot Token" field here.</p>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
          <button className="btn btn-primary" onClick={onClose}>Understood</button>
        </div>
      </div>
    </div>
  );
};
