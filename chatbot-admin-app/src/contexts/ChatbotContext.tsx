import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'; import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';
import type { ChatbotDetails } from '../types';


interface ChatbotContextType {
  chatbot: ChatbotDetails | null;
  credits: number;
  businessPlanInfo: any;
  setChatbot: (bot: ChatbotDetails | null) => void;
  loadProfileData: () => Promise<void>;
  showInAppTour: boolean;
  setShowInAppTour: (show: boolean) => void;
}

const ChatbotContext = createContext<ChatbotContextType | undefined>(undefined);

export const ChatbotProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { token, fetchProfile, initialProfileData } = useAuth();
  
  const [chatbot, setChatbot] = useState<ChatbotDetails | null>(null);
  const [credits, setCredits] = useState<number>(0);
  const [businessPlanInfo, setBusinessPlanInfo] = useState<any>(null);
  const [showInAppTour, setShowInAppTour] = useState(false);

  const loadProfileData = useCallback(async () => {
    if (!token) return;
    const data = await fetchProfile();
    if (data && data.success) {
      setChatbot(data.chatbot);
      setCredits(data.credits);
      setBusinessPlanInfo(data.business);
      
      if (data.chatbot) {
        const inAppTourDone = localStorage.getItem('chatbot_admin_intro_completed');
        if (!inAppTourDone) {
          setShowInAppTour(true);
        }
      }
    }
  }, [token, fetchProfile]);

  useEffect(() => {
    if (initialProfileData && initialProfileData.success) {
      setChatbot(initialProfileData.chatbot);
      setCredits(initialProfileData.credits);
      setBusinessPlanInfo(initialProfileData.business);
      
      if (initialProfileData.chatbot) {
        const inAppTourDone = localStorage.getItem('chatbot_admin_intro_completed');
        if (!inAppTourDone) {
          setShowInAppTour(true);
        }
      }
    } else {
      loadProfileData();
    }
  }, [initialProfileData, loadProfileData]);

  // Clean up when logged out
  useEffect(() => {
    if (!token) {
      setChatbot(null);
      setCredits(0);
      setBusinessPlanInfo(null);
    }
  }, [token]);

  return (
    <ChatbotContext.Provider value={{ 
      chatbot, 
      credits, 
      businessPlanInfo, 
      setChatbot, 
      loadProfileData,
      showInAppTour,
      setShowInAppTour
    }}>
      {children}
    </ChatbotContext.Provider>
  );
};

export const useChatbot = () => {
  const context = useContext(ChatbotContext);
  if (context === undefined) {
    throw new Error('useChatbot must be used within a ChatbotProvider');
  }
  return context;
};
