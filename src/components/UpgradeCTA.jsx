import React from 'react';
import { Sparkles, Video, Crown } from 'lucide-react';
import { GlassCard, SolidButton, C } from './ui';

export default function UpgradeCTA({ fromPlan = 'free', onUpgrade }) {
  const cfg = fromPlan === 'free'
    ? { icon: Sparkles, title: 'Better result ke liye Pro try karo', text: 'Stance, Impact aur Follow-through ki 3-frame skeleton + angle analysis pao.', label: 'Pro ₹99' }
    : fromPlan === 'pro_99'
      ? { icon: Video, title: 'Video Visualization try karo', text: 'Apne shot ka moving skeleton, ball trajectory, tappa aur coaching overlay video me dekho.', label: 'Video Visualization ₹499' }
      : { icon: Crown, title: 'Special Coaching unlock karo', text: 'Personal AI coach, training roadmap, progress aur cricket-only coach chat.', label: 'Special Coaching ₹999' };
  const Icon = cfg.icon;
  return <GlassCard className="p-4" style={{ border: `1px solid ${C.gold}55`, background: 'rgba(245,158,11,.06)' }}>
    <div className="flex gap-3 items-start"><Icon size={20} style={{ color: C.gold }} />
      <div className="flex-1"><div className="text-sm font-extrabold" style={{ color: C.text }}>{cfg.title}</div><div className="text-xs mt-1" style={{ color: C.muted }}>{cfg.text}</div>
        {onUpgrade && <SolidButton tone="gold" className="mt-3 py-2" onClick={onUpgrade}>{cfg.label}</SolidButton>}
      </div>
    </div>
  </GlassCard>;
}
