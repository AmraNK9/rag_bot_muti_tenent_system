import React, { useState } from 'react';
import { useTranslation, Trans } from 'react-i18next';

interface TokenHelpModalProps {
  onClose: () => void;
}

/* ──────────────────────────────────────────────────
   Step definitions — all display text comes from
   i18n keys so MM / EN toggle works seamlessly.
────────────────────────────────────────────────── */
const STEPS = [
  {
    id: 1,
    icon: '🤖',
    color: '#0a84ff',
    labelKey: 'tokenHelp.step1Label',
    titleKey: 'tokenHelp.step1Title',
    instructions: [
      {
        emoji: '📱',
        i18nKey: 'tokenHelp.step1_1',
        components: { b: <strong /> },
      },
      {
        emoji: '🔍',
        i18nKey: 'tokenHelp.step1_2',
        components: {
          b: <strong />,
          blue: <span style={{ color: '#0a84ff' }} />,
        },
      },
      {
        emoji: '▶️',
        i18nKey: 'tokenHelp.step1_3',
        components: { b: <strong /> },
      },
    ],
  },
  {
    id: 2,
    icon: '✨',
    color: '#32d74b',
    labelKey: 'tokenHelp.step2Label',
    titleKey: 'tokenHelp.step2Title',
    instructions: [
      {
        emoji: '⌨️',
        i18nKey: 'tokenHelp.step2_1',
        components: { b: <strong /> },
      },
      {
        emoji: '🏷️',
        i18nKey: 'tokenHelp.step2_2',
        components: { b: <strong /> },
      },
      {
        emoji: '🔗',
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
    icon: '🔑',
    color: '#ffd60a',
    labelKey: 'tokenHelp.step3Label',
    titleKey: 'tokenHelp.step3Title',
    instructions: [
      {
        emoji: '📨',
        i18nKey: 'tokenHelp.step3_1',
        components: { b: <strong /> },
      },
      {
        emoji: '📋',
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
      {
        emoji: '✅',
        i18nKey: 'tokenHelp.step3_3',
        components: { b: <strong /> },
      },
    ],
  },
] as const;

export const TokenHelpModal: React.FC<TokenHelpModalProps> = ({ onClose }) => {
  const { t } = useTranslation('bot');
  const [activeStep, setActiveStep] = useState(0);
  const step = STEPS[activeStep];

  const goNext = () => {
    if (activeStep < STEPS.length - 1) setActiveStep((s) => s + 1);
    else onClose();
  };

  const goPrev = () => {
    if (activeStep > 0) setActiveStep((s) => s - 1);
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 2000 }}>
      <div className="modal" style={{ maxHeight: '88vh' }}>
        {/* Handle */}
        <div className="modal-handle" />

        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'rgba(10,132,255,0.15)',
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
          <button
            onClick={onClose}
            className="btn-icon"
            aria-label={t('tokenHelp.close')}
            style={{ fontSize: '1.1rem' }}
          >
            ✕
          </button>
        </div>

        {/* Step progress pills */}
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
                gap: 4,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '6px 4px',
                borderRadius: 10,
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

        {/* Step content */}
        <div
          className="modal-body"
          style={{ paddingTop: 18, paddingBottom: 8 }}
          key={activeStep}
        >
          {/* Step icon & title card */}
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
                {t('tokenHelp.stepOf', {
                  current: step.id,
                  total: STEPS.length,
                })}
              </div>
              <div
                style={{
                  fontSize: '1rem',
                  fontWeight: 700,
                  letterSpacing: '-0.2px',
                }}
              >
                {t(step.titleKey)}
              </div>
            </div>
          </div>

          {/* Instruction rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {step.instructions.map((item, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  padding: '12px 14px',
                  background: 'var(--bg-surface-2)',
                  borderRadius: 'var(--radius-sm)',
                  border: '0.5px solid var(--border-light)',
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: 'rgba(255,255,255,0.06)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1rem',
                    flexShrink: 0,
                  }}
                >
                  {item.emoji}
                </div>
                <p
                  style={{
                    fontSize: '0.875rem',
                    lineHeight: 1.55,
                    color: 'var(--text-main)',
                    paddingTop: 5,
                  }}
                >
                  <Trans
                    i18nKey={item.i18nKey}
                    ns="bot"
                    components={item.components as any}
                  />
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer nav */}
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
              onClick={onClose}
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
            {activeStep < STEPS.length - 1
              ? t('tokenHelp.next')
              : t('tokenHelp.done')}
          </button>
        </div>
      </div>
    </div>
  );
};
