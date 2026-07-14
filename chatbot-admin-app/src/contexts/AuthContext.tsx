import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'; import type { ReactNode } from 'react';
import { getProfile } from '../api/client';
import type { AdminProfile } from '../types';

interface AuthContextType {
  token: string | null;
  profile: AdminProfile | null;
  loadingProfile: boolean;
  initialized: boolean;
  initialProfileData: any;
  login: (token: string) => void;
  logout: () => void;
  fetchProfile: () => Promise<any>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('chatbot_admin_token'));
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [initialProfileData, setInitialProfileData] = useState<any>(null);

  const logout = useCallback(() => {
    localStorage.removeItem('chatbot_admin_token');
    setToken(null);
    setProfile(null);
    setInitialProfileData(null);
  }, []);

  const login = useCallback((newToken: string) => {
    setInitialized(false);
    localStorage.setItem('chatbot_admin_token', newToken);
    setToken(newToken);
  }, []);

  const fetchProfile = useCallback(async () => {
    setLoadingProfile(true);
    try {
      const data = await getProfile();
      if (data.success) {
        setProfile(data.admin);
        setInitialProfileData(data);
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

  useEffect(() => {
    if (token) {
      fetchProfile().finally(() => {
        setInitialized(true);
      });
    } else {
      setInitialized(true);
    }
  }, [token, fetchProfile]);

  return (
    <AuthContext.Provider value={{ token, profile, loadingProfile, initialized, initialProfileData, login, logout, fetchProfile }}>
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

