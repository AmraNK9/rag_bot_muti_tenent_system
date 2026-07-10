import React, { useMemo } from 'react';
import Joyride, { Step, CallBackProps, STATUS } from 'react-joyride';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../contexts/AuthContext';
import { useChatbot } from '../../../contexts/ChatbotContext';
import { Bot, MessageSquare, ListTodo, BookOpen, Settings } from 'lucide-react';

export const InAppTour: React.FC = () => {
  const { t } = useTranslation('common');
  const { chatbot, showInAppTour, setShowInAppTour } = useChatbot();

  const { profile } = useAuth();

  const steps: Step[] = useMemo(() => {
    const baseSteps: Step[] = [
      {
        target: 'body',
        placement: 'center',
        content: (
          <div style={{ textAlign: 'center', padding: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
              <Bot size={40} color="var(--primary)" />
            </div>
            <h3 style={{ margin: '0 0 8px', color: 'var(--text-main)', fontSize: '1.2rem' }}>
              {t('tour.welcomeTitle')}
            </h3>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.5 }}>
              {t('tour.welcomeDesc')}
            </p>
          </div>
        ),
        disableBeacon: true,
      },
      {
        target: '#tour-chats-tab',
        placement: 'top',
        content: (
          <div style={{ padding: '4px' }}>
            <h4 style={{ margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--primary)' }}>
              <MessageSquare size={16} /> {t('tour.chatsTitle')}
            </h4>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-main)' }}>
              {t('tour.chatsDesc')}
            </p>
          </div>
        ),
      },
      {
        target: '#tour-actions-tab',
        placement: 'top',
        content: (
          <div style={{ padding: '4px' }}>
            <h4 style={{ margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--primary)' }}>
              <ListTodo size={16} /> {t('tour.actionsTitle')}
            </h4>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-main)' }}>
              {t('tour.actionsDesc')}
            </p>
          </div>
        ),
      }
    ];

    if (profile?.canManageKnowledge) {
      baseSteps.push({
        target: '#tour-knowledge-tab',
        placement: 'top',
        content: (
          <div style={{ padding: '4px' }}>
            <h4 style={{ margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--primary)' }}>
              <BookOpen size={16} /> {t('tour.smartItemsTitle')}
            </h4>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-main)' }}>
              {t('tour.smartItemsDesc')}
            </p>
          </div>
        ),
      });
    }

    baseSteps.push({
      target: '#tour-settings-btn',
      placement: 'bottom',
      content: (
        <div style={{ padding: '4px' }}>
          <h4 style={{ margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--primary)' }}>
            <Settings size={16} /> {t('tour.settingsTitle')}
          </h4>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-main)' }}>
            {t('tour.settingsDesc')}
          </p>
        </div>
      ),
    });

    baseSteps.push({
      target: 'body',
      placement: 'center',
      content: (
        <div style={{ textAlign: 'center', padding: '10px' }}>
          <h3 style={{ margin: '0 0 8px', color: 'var(--primary)', fontSize: '1.2rem' }}>
            {t('tour.finalTitle')}
          </h3>
          <p style={{ margin: '0 0 16px', color: 'var(--text-main)', fontSize: '0.9rem', lineHeight: 1.5 }}>
            {t('tour.finalDesc')}
          </p>
          {chatbot?.telegram_username ? (
            <a
              href={`https://t.me/${chatbot.telegram_username}`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-primary"
              style={{ display: 'inline-block', textDecoration: 'none', padding: '8px 16px', fontWeight: 'bold' }}
            >
              t.me/{chatbot.telegram_username}
            </a>
          ) : (
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Please connect your bot token in settings to get the link.
            </div>
          )}
        </div>
      ),
    });

    return baseSteps;
  }, [t, chatbot, profile?.canManageKnowledge]);

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status)) {
      setShowInAppTour(false);
      localStorage.setItem('chatbot_admin_intro_completed', 'true');
    }
  };

  return (
    <Joyride
      callback={handleJoyrideCallback}
      continuous
      hideCloseButton
      run={showInAppTour}
      scrollToFirstStep
      showProgress
      showSkipButton
      steps={steps}
      styles={{
        options: {
          zIndex: 10000,
          primaryColor: 'var(--primary)',
          textColor: 'var(--text-main)',
          backgroundColor: 'var(--bg-surface)',
          arrowColor: 'var(--bg-surface)',
          overlayColor: 'rgba(0, 0, 0, 0.5)',
        },
        tooltipContainer: {
          textAlign: 'left'
        },
        buttonNext: {
          backgroundColor: 'var(--primary)',
          borderRadius: 'var(--radius)',
        },
        buttonBack: {
          color: 'var(--text-muted)',
          marginRight: 10,
        },
        buttonSkip: {
          color: 'var(--text-muted)',
        }
      }}
      locale={{
        last: t('tour.last'),
        skip: t('tour.skip'),
        next: t('tour.next'),
        back: t('tour.back'),
        close: t('tour.close'),
      }}
    />
  );
};
