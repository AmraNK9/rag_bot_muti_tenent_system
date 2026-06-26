import React, { useState } from 'react';

interface LandingOnboardingProps {
  onComplete: () => void;
}

const slides = [
  {
    emoji: '🧠',
    title: 'Knowledge-Aware AI',
    desc: 'သင့်လုပ်ငန်းဆိုင်ရာ အချက်အလက်တွေကို AI အားသင်ကြားပေးပြီး Customer မေးခွန်းများကို ၂၄ နာရီ တိကျစွာ ဖြေကြားပေးနိုင်ပါသည်။',
  },
  {
    emoji: '⚡',
    title: 'Fast Setup, No Code',
    desc: 'Coding ရေးရန် လုံးဝမလိုပါ။ ၅ မိနစ်အတွင်း Telegram Bot ကို ချိတ်ဆက်ပြီး Customer Response ကို Automate လုပ်နိုင်ပါသည်။',
  },
  {
    emoji: '💎',
    title: 'Affordable Plans',
    desc: 'SME လုပ်ငန်းများအတွက် ရည်ရွယ်ပြီး တတ်နိုင်သော ဈေးနှုန်းဖြင့် မိမိနှစ်သက်ရာ Package ကို ရွေးချယ်နိုင်ပါသည်။',
  },
];

export const LandingOnboarding: React.FC<LandingOnboardingProps> = ({ onComplete }) => {
  const [step, setStep] = useState(0);

  const next = () => {
    if (step < slides.length - 1) {
      setStep(s => s + 1);
    } else {
      localStorage.setItem('chatbot_admin_landing_completed', 'true');
      onComplete();
    }
  };

  const slide = slides[step];

  return (
    <div className="landing-screen">
      <div className="landing-slide">
        <div className="landing-emoji">{slide.emoji}</div>
        <h1 className="landing-title">{slide.title}</h1>
        <p className="landing-desc">{slide.desc}</p>
      </div>

      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
        <div className="landing-dots">
          {slides.map((_, i) => (
            <div
              key={i}
              className={`landing-dot ${i === step ? 'active' : ''}`}
              onClick={() => setStep(i)}
            />
          ))}
        </div>

        <div className="landing-cta">
          <button
            className="btn btn-primary"
            onClick={next}
            style={{ borderRadius: 28, minHeight: 52, fontSize: '1rem' }}
          >
            {step < slides.length - 1 ? 'Next →' : 'Get Started 🚀'}
          </button>
        </div>
      </div>
    </div>
  );
};
