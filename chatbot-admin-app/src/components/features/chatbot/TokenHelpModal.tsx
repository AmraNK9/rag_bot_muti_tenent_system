import React, { useState } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { Bot, Sparkles, Key, Smartphone, Search, Play, Keyboard, Tag, Link, Mail, Clipboard, CheckCircle } from 'lucide-react';

/* ─── P3: Step-change fade+slide animation injected once ─── */
const STEP_ANIM_STYLE = `
@keyframes stepFadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
.token-step-body {
  animation: stepFadeIn 0.22s cubic-bezier(0.25, 1, 0.5, 1);
}
`;

interface TokenHelpContentProps {
  onBack: () => void;
  /** Called when user taps "Got it!" on the final step (vs plain back) */
  onComplete?: () => void;
}

/* ─── Step data — i18n keys and images ─── */
const STEPS = [
  {
    id: 1,
    icon: <Bot size={22} color="currentColor" />,
    color: '#0a84ff',
    labelKey: 'tokenHelp.step1Label',
    titleKey: 'tokenHelp.step1Title',
    deepLink: 'https://t.me/BotFather',
    deepLinkKey: 'tokenHelp.step1DeepLink',
    image: '/help/step1.png',
    instructions: [
      { icon: <Smartphone size={16} />, i18nKey: 'tokenHelp.step1_1', components: { b: <strong /> } },
      {
        icon: <Search size={16} />,
        i18nKey: 'tokenHelp.step1_2',
        components: {
          b: <strong />,
          blue: <span style={{ color: '#0a84ff' }} />,
        },
      },
      { icon: <Play size={16} />, i18nKey: 'tokenHelp.step1_3', components: { b: <strong /> } },
    ],
  },
  {
    id: 2,
    icon: <Sparkles size={22} color="currentColor" />,
    color: '#32d74b',
    labelKey: 'tokenHelp.step2Label',
    titleKey: 'tokenHelp.step2Title',
    deepLink: null,
    deepLinkKey: null,
    image: '/help/step2.png',
    instructions: [
      { icon: <Keyboard size={16} />, i18nKey: 'tokenHelp.step2_1', components: { b: <strong /> } },
      { icon: <Tag size={16} />, i18nKey: 'tokenHelp.step2_2', components: { b: <strong /> } },
      {
        icon: <Link size={16} />,
        i18nKey: 'tokenHelp.step2_3',
        components: {
          b: <strong />,
          code: (
            <code
              style={{
                background: 'rgba(50,215,75,0.15)',
                color: '#32d74b',
                padding: '1px 6px',
                borderRadius: 5,
                fontSize: '0.83rem',
              }}
            />
          ),
        },
      },
    ],
  },
  {
    id: 3,
    icon: <Key size={22} color="currentColor" />,
    color: '#ffd60a',
    labelKey: 'tokenHelp.step3Label',
    titleKey: 'tokenHelp.step3Title',
    deepLink: null,
    deepLinkKey: null,
    image: '/help/step3.png',
    instructions: [
      { icon: <Mail size={16} />, i18nKey: 'tokenHelp.step3_1', components: { b: <strong /> } },
      {
        icon: <Clipboard size={16} />,
        i18nKey: 'tokenHelp.step3_2',
        components: {
          b: <strong />,
          code: (
            <code
              style={{
                background: 'rgba(255,214,10,0.12)',
                color: '#ffd60a',
                padding: '2px 7px',
                borderRadius: 5,
                fontSize: '0.75rem',
                wordBreak: 'break-all',
              }}
            />
          ),
        },
      },
      { icon: <CheckCircle size={16} />, i18nKey: 'tokenHelp.step3_3', components: { b: <strong /> } },
    ],
  },
] as const;

export const TokenHelpModal: React.FC<TokenHelpContentProps> = ({ onBack, onComplete }) => {
  const { t } = useTranslation('bot');
  const [activeStep, setActiveStep] = useState(0);
  const step = STEPS[activeStep];
  const isLastStep = activeStep === STEPS.length - 1;

  const goNext = () => {
    if (!isLastStep) {
      setActiveStep((s) => s + 1);
    } else {
      // "Got it!" triggers onComplete so parent can highlight token field
      onComplete ? onComplete() : onBack();
    }
  };

  const goPrev = () => {
    if (activeStep > 0) setActiveStep((s) => s - 1);
  };

  return (
    <>
      <style>{STEP_ANIM_STYLE}</style>

      {/* ── Header ── */}
      <div className="modal-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={onBack}
            className="btn-icon"
            aria-label="Back"
            style={{ fontSize: '1.2rem', marginRight: 4, width: 32, height: 32 }}
          >
            ←
          </button>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'var(--primary-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.1rem',
              flexShrink: 0,
            }}
          >
            🔑
          </div>
          <div>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, letterSpacing: '-0.2px' }}>
              {t('tokenHelp.modalTitle')}
            </h2>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 1 }}>
              {t('tokenHelp.modalSubtitle')}
            </p>
          </div>
        </div>
      </div>

      {/* ── Step progress tabs ── */}
      <div style={{ display: 'flex', gap: 6, padding: '14px 20px 0' }}>
        {STEPS.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setActiveStep(i)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 5,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '6px 4px',
              borderRadius: 10,
              minHeight: 48,
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: '100%',
                height: 3,
                borderRadius: 2,
                background: i <= activeStep ? s.color : 'rgba(255,255,255,0.10)',
                transition: 'background 0.3s ease',
              }}
            />
            <span
              style={{
                fontSize: '0.68rem',
                fontWeight: 600,
                color: i === activeStep ? s.color : 'var(--text-muted)',
                transition: 'color 0.2s',
                letterSpacing: '0.1px',
                whiteSpace: 'nowrap',
              }}
            >
              {t(s.labelKey)}
            </span>
          </button>
        ))}
      </div>

      {/* ── Step content (Animated) ── */}
      <div
        key={activeStep}
        className="token-step-body modal-body"
        style={{ paddingTop: 18, paddingBottom: 8 }}
      >
        {/* Step title card */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 20,
            padding: '14px 16px',
            background: 'var(--bg-surface-2)',
            borderRadius: 'var(--radius)',
            border: `1px solid ${step.color}22`,
          }}
        >
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 14,
              background: `${step.color}1a`,
              border: `1.5px solid ${step.color}40`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem',
              flexShrink: 0,
            }}
          >
            {step.icon}
          </div>
          <div>
            <div
              style={{
                fontSize: '0.65rem',
                fontWeight: 700,
                color: step.color,
                textTransform: 'uppercase',
                letterSpacing: '0.8px',
                marginBottom: 2,
              }}
            >
              {t('tokenHelp.stepOf', { current: step.id, total: STEPS.length })}
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 700, letterSpacing: '-0.2px' }}>
              {t(step.titleKey)}
            </div>
          </div>
        </div>

        {/* ── Visual Screenshot Mockup ── */}
        {step.image && (
          <div style={{ marginBottom: 20, borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border-light)' }}>
             <img src={step.image} alt={t(step.titleKey)} style={{ width: '100%', display: 'block' }} />
          </div>
        )}

        {/* Instruction rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {step.instructions.map((item, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                padding: '11px 14px',
                background: 'var(--bg-surface-2)',
                borderRadius: 'var(--radius-sm)',
                border: '0.5px solid var(--border-light)',
              }}
            >
              <div
                style={{
                  flexShrink: 0,
                  width: 24,
                  height: 24,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-muted)'
                }}
              >
                {item.icon}
              </div>
              <p
                style={{
                  fontSize: '0.875rem',
                  lineHeight: 1.55,
                  color: 'var(--text-main)',
                  paddingTop: 5,
                }}
              >
                <Trans i18nKey={item.i18nKey} ns="bot" components={item.components as any} />
              </p>
            </div>
          ))}
        </div>

        {/* ── BotFather deep link (Step 1 only) ── */}
        {activeStep === 0 && (
          <a
            href="https://t.me/BotFather"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              marginTop: 14,
              padding: '13px 16px',
              background: 'var(--primary-bg)',
              border: '1.5px solid rgba(10,132,255,0.3)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--primary)',
              fontWeight: 700,
              fontSize: '0.88rem',
              textDecoration: 'none',
              transition: 'all 0.15s',
              letterSpacing: '-0.1px',
            }}
          >
            <span style={{ fontSize: '1.1rem' }}>✈️</span>
            {t('tokenHelp.step1DeepLink')}
          </a>
        )}

        {/* ── Step 3 — tell user what happens BEFORE they tap "Got it!" ── */}
        {isLastStep && (
          <div
            style={{
              marginTop: 14,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: '11px 14px',
              background: 'rgba(255,214,10,0.08)',
              border: '1px solid rgba(255,214,10,0.22)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.8rem',
              color: 'rgba(255,214,10,0.95)',
              lineHeight: 1.5,
            }}
          >
            <span style={{ fontSize: '1rem', flexShrink: 0, marginTop: 1 }}>💡</span>
            <span>{t('tokenHelp.step3PasteNote')}</span>
          </div>
        )}
      </div>

      {/* ── Footer navigation ── */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          padding: '12px 20px',
          paddingBottom: 'max(16px, env(safe-area-inset-bottom, 16px))',
          borderTop: '0.5px solid var(--border)',
        }}
      >
        {activeStep > 0 ? (
          <button
            className="btn btn-secondary btn-sm"
            onClick={goPrev}
            style={{ flex: 1 }}
          >
            {t('tokenHelp.back')}
          </button>
        ) : (
          <button
            className="btn btn-secondary btn-sm"
            onClick={onBack}
            style={{ flex: 1 }}
          >
            {t('tokenHelp.close')}
          </button>
        )}

        <button
          className="btn btn-primary btn-sm"
          onClick={goNext}
          style={{ flex: 2 }}
        >
          {isLastStep ? t('tokenHelp.done') : t('tokenHelp.next')}
        </button>
      </div>
    </>
  );
};
