import React from 'react';

interface ZoomModalProps {
  imageUrl: string;
  onClose: () => void;
}

export const getImgSrc = (url: string) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return url.startsWith('/') ? url : `/${url}`;
};

export const handleImgError = (e: React.SyntheticEvent<HTMLImageElement>, url: string) => {
  const img = e.currentTarget;
  if (img.dataset.fallbackTried) return;
  img.dataset.fallbackTried = '1';
  const base = url.startsWith('/') ? `http://localhost:3000${url}` : `http://localhost:3000/${url}`;
  img.src = base;
};

export const ZoomModal: React.FC<ZoomModalProps> = ({ imageUrl, onClose }) => {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: '420px', padding: '16px' }} onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>
        <h3 style={{ marginBottom: '14px' }}>Receipt Screenshot</h3>
        <img
          src={getImgSrc(imageUrl)}
          alt="Payment Receipt"
          style={{ width: '100%', height: 'auto', maxHeight: '80vh', objectFit: 'contain', borderRadius: '8px', display: 'block' }}
          onError={(e) => handleImgError(e, imageUrl)}
        />
      </div>
    </div>
  );
};
