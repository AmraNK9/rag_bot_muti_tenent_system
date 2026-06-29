import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// ── Namespaced locale imports ─────────────────────────────────────────────────
import myCommon from './locales/my/common.json';
import mySmartItems from './locales/my/smartItems.json';
import myAuth from './locales/my/auth.json';
import myChats from './locales/my/chats.json';
import myPrompt from './locales/my/prompt.json';
import myBilling from './locales/my/billing.json';
import myBot from './locales/my/bot.json';

import enCommon from './locales/en/common.json';
import enSmartItems from './locales/en/smartItems.json';
import enAuth from './locales/en/auth.json';
import enChats from './locales/en/chats.json';
import enPrompt from './locales/en/prompt.json';
import enBilling from './locales/en/billing.json';
import enBot from './locales/en/bot.json';

const savedLang = localStorage.getItem('chatbot_admin_lang') || 'my';

// ── i18next configuration ─────────────────────────────────────────────────────
i18n
  .use(initReactI18next)
  .init({
    lng: savedLang, // Force default to Myanmar (or user's saved preference)
    fallbackLng: 'en', // Fallback to English if a key is completely missing
    defaultNS: 'common',
    supportedLngs: ['my', 'en'],

    resources: {
      my: {
        common: myCommon,
        smartItems: mySmartItems,
        auth: myAuth,
        chats: myChats,
        prompt: myPrompt,
        billing: myBilling,
        bot: myBot,
      },
      en: {
        common: enCommon,
        smartItems: enSmartItems,
        auth: enAuth,
        chats: enChats,
        prompt: enPrompt,
        billing: enBilling,
        bot: enBot,
      },
    },

    interpolation: {
      escapeValue: false, // React already escapes by default
    },
  });

export default i18n;
