import React, { createContext, useContext, useState, useCallback } from 'react'; import type { ReactNode } from 'react';
import { getProfile } from '../api/client';
import type { AdminProfile } from '../types';

interface AuthContextType {
  token: string | null;
  profile: AdminProfile | null;
  loadingProfile: boolean;
  login: (token: string) => void;
  logout: () => void;
  fetchProfile: () => Promise<any>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('chatbot_admin_token'));
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  const logout = useCallback(() => {
    localStorage.removeItem('chatbot_admin_token');
    setToken(null);
    setProfile(null);
  }, []);

  const login = useCallback((newToken: string) => {
    localStorage.setItem('chatbot_admin_token', newToken);
    setToken(newToken);
  }, []);

  const fetchProfile = useCallback(async () => {
    setLoadingProfile(true);
    try {
      const data = await getProfile();
      if (data.success) {
        setProfile(data.admin);
        return data; // Return full data so ChatbotContext can use it
      } else {
        logout();
      }
    } catch (e) {
      console.error(e);
      logout();
    } finally {
      setLoadingProfile(false);
    }
    return null;
  }, [logout]);

  return (
    <AuthContext.Provider value={{ token, profile, loadingProfile, login, logout, fetchProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
