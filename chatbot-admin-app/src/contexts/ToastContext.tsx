import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: number;
  type: ToastType;
  title: string;
  message?: string;
  exiting?: boolean;
  duration: number;
}

interface ToastContextValue {
  showToast: (type: ToastType, title: string, message?: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export const useToast = () => useContext(ToastContext);

const ICONS: Record<ToastType, string> = {
  success: '✅',
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️',
};

const ARIA_ROLES: Record<ToastType, 'alert' | 'status'> = {
  success: 'status',
  error: 'alert',
  warning: 'alert',
  info: 'status',
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counterRef = useRef(0);

  const removeToast = useCallback((id: number) => {
    // Trigger exit animation first
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 280);
  }, []);

  const showToast = useCallback((
    type: ToastType,
    title: string,
    message?: string,
    duration = 3500,
  ) => {
    // Deduplicate: skip if identical toast is already visible
    setToasts(prev => {
      const isDuplicate = prev.some(
        t => !t.exiting && t.type === type && t.title === title && t.message === message
      );
      if (isDuplicate) return prev;

      const id = ++counterRef.current;
      // Schedule auto-dismiss
      setTimeout(() => removeToast(id), duration);
      return [...prev, { id, type, title, message, duration }];
    });
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-container" aria-live="polite" aria-atomic="false">
        {toasts.map(t => (
          <div
            key={t.id}
            role={ARIA_ROLES[t.type]}
            className={`toast toast-${t.type}${t.exiting ? ' toast-exit' : ''}`}
            onClick={() => removeToast(t.id)}
          >
            <span className="toast-icon" aria-hidden="true">{ICONS[t.type]}</span>
            <div className="toast-body">
              <div className="toast-title">{t.title}</div>
              {t.message && <div className="toast-msg">{t.message}</div>}
            </div>
            <button
              className="toast-close"
              onClick={e => { e.stopPropagation(); removeToast(t.id); }}
              aria-label="Dismiss notification"
            >✕</button>
            {!t.exiting && (
              <div
                className="toast-progress"
                style={{ animationDuration: `${t.duration}ms` }}
              />
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
