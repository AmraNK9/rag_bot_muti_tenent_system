import { createContext, useContext, useState, ReactNode } from 'react';

interface Business {
  id: number;
  name: string;
  plan: string;
  active_messages_count: number;
}

interface AuthContextType {
  token: string | null;
  business: Business | null;
  isAuthenticated: boolean;
  loginUser: (token: string, business: Business) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('admin_token'));
  const [business, setBusiness] = useState<Business | null>(() => {
    const stored = localStorage.getItem('admin_business');
    return stored ? JSON.parse(stored) : null;
  });

  const loginUser = (newToken: string, newBusiness: Business) => {
    localStorage.setItem('admin_token', newToken);
    localStorage.setItem('admin_business', JSON.stringify(newBusiness));
    setToken(newToken);
    setBusiness(newBusiness);
  };

  const logout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_business');
    setToken(null);
    setBusiness(null);
  };

  return (
    <AuthContext.Provider value={{ token, business, isAuthenticated: !!token, loginUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
