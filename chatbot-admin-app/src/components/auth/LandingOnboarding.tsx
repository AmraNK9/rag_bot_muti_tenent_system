import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { BrainCircuit, Zap, Gem } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

interface LandingOnboardingProps {
  onComplete: () => void;
}

const slidesConfig = [
  {
    iconComponent: BrainCircuit,
    titleKey: 'landing.slide1Title',
    descKey: 'landing.slide1Desc',
    darkGradient: 'linear-gradient(160deg, #060d1f 0%, #000000 70%)',
    lightGradient: 'linear-gradient(160deg, #e6f0ff 0%, #ffffff 70%)',
    accentColor: '#0a84ff',
  },
  {
    iconComponent: Zap,
    titleKey: 'landing.slide2Title',
    descKey: 'landing.slide2Desc',
    darkGradient: 'linear-gradient(160deg, #0d1a0f 0%, #000000 70%)',
    lightGradient: 'linear-gradient(160deg, #e8f9eb 0%, #ffffff 70%)',
    accentColor: '#32d74b',
  },
  {
    iconComponent: Gem,
    titleKey: 'landing.slide3Title',
    descKey: 'landing.slide3Desc',
    darkGradient: 'linear-gradient(160deg, #1a0d1a 0%, #000000 70%)',
    lightGradient: 'linear-gradient(160deg, #f5e8ff 0%, #ffffff 70%)',
    accentColor: '#bf5af2',
  },
];

// Minimum horizontal distance (px) to trigger a swipe
const SWIPE_THRESHOLD = 50;

export const LandingOnboarding: React.FC<LandingOnboardingProps> = ({ onComplete }) => {
  const { t } = useTranslation('auth');
  const { effectiveTheme } = useTheme();
  const [step, setStep] = useState(0);
  const [animDir, setAnimDir] = useState<'left' | 'right' | null>(null);

  // Compute slides based on theme
  const slides = slidesConfig.map(s => ({
    ...s,
    icon: <s.iconComponent size={48} color={effectiveTheme === 'light' ? s.accentColor : 'white'} strokeWidth={1.5} />,
    gradient: effectiveTheme === 'light' ? s.lightGradient : s.darkGradient,
  }));

  // Touch tracking refs — no re-renders on every touch move
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const isSwiping = useRef(false);

  const goTo = (next: number, dir: 'left' | 'right') => {
    if (next < 0 || next >= slides.length) return;
    setAnimDir(dir);
    // Small delay so the exit animation plays before content swaps
    setTimeout(() => {
      setStep(next);
      setAnimDir(null);
    }, 180);
  };

  const next = () => {
    if (step < slides.length - 1) {
      goTo(step + 1, 'left');
    } else {
      localStorage.setItem('chatbot_admin_landing_completed', 'true');
      onComplete();
    }
  };

  const prev = () => {
    if (step > 0) goTo(step - 1, 'right');
  };

  // ── Touch handlers ────────────────────────────────────────────────────────
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isSwiping.current = false;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;
    // Only block scroll if horizontal movement dominates
    if (Math.abs(dx) > Math.abs(dy)) {
      isSwiping.current = true;
      e.preventDefault(); // prevent page scroll while swiping slides
    }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || !isSwiping.current) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    touchStartY.current = null;
    isSwiping.current = false;

    if (dx < -SWIPE_THRESHOLD) {
      // Swipe LEFT → go forward
      next();
    } else if (dx > SWIPE_THRESHOLD) {
      // Swipe RIGHT → go back
      prev();
    }
  };

  const slide = slides[step];

  // Slide animation class
  const slideClass = animDir === 'left'
    ? 'landing-slide slide-exit-left'
    : animDir === 'right'
    ? 'landing-slide slide-exit-right'
    : 'landing-slide slide-enter';

  return (
    <div
      className="landing-screen"
      style={{ background: slide.gradient, transition: 'background 0.5s ease' }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Swipe hint — only shown on slide 1, fades out */}
      {step === 0 && (
        <div className="swipe-hint">
          <span>← {t('landing.swipeHint', 'Swipe to explore')} →</span>
        </div>
      )}

      {/* Slide content */}
      <div key={step} className={slideClass}>
        {/* Accent glow behind emoji */}
        <div
          className="landing-emoji-wrap"
          style={{ '--accent': slide.accentColor } as React.CSSProperties}
        >
          <div className="landing-emoji">{slide.icon}</div>
        </div>
        <h1 className="landing-title">{t(slide.titleKey)}</h1>
        <p className="landing-desc">{t(slide.descKey)}</p>
      </div>

      {/* Bottom controls */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
        {/* Dots */}
        <div className="landing-dots">
          {slides.map((_, i) => (
            <div
              key={i}
              className={`landing-dot ${i === step ? 'active' : ''}`}
              style={i === step ? { background: slide.accentColor } : undefined}
              onClick={() => i !== step && goTo(i, i > step ? 'left' : 'right')}
            />
          ))}
        </div>

        {/* CTA */}
        <div className="landing-cta">
          <button
            className="btn btn-primary"
            onClick={next}
            style={{
              borderRadius: 28,
              minHeight: 52,
              fontSize: '1rem',
              color: 'white',
              background: effectiveTheme === 'light' 
                ? `linear-gradient(135deg, ${slide.accentColor}, ${slide.accentColor}ee)`
                : `linear-gradient(135deg, ${slide.accentColor}, ${slide.accentColor}cc)`,
              boxShadow: `0 6px 24px ${slide.accentColor}55`,
              transition: 'background 0.4s ease, box-shadow 0.4s ease',
              border: 'none'
            }}
          >
            {step < slides.length - 1 ? t('landing.next') : t('landing.getStarted')}
          </button>
        </div>
      </div>
    </div>
  );
};
