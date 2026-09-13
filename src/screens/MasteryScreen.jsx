import React from "react";
import { Lock, CheckCircle2, PlayCircle, AlarmClock } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabaseClient";
import { C, GlassCard, SolidButton, SectionTitle } from "../components/ui";
import { MASTERY_LEVELS } from "../data/masteryLevels";
import { isLevelUnlocked, isLevelPassed, getCurrentLevel } from "../lib/mastery";
import { daysUntilTest, testCountdownLabel, scheduleNextTest } from "../lib/testSchedule";

export default function MasteryScreen({ isPaid, setTab }) {
  const { user, profile, refreshProfile } = useAuth();

  if (!isPaid) {
    return (
      <div className="space-y-4">
        <SectionTitle sub="Level-by-level roadmap: Defense se Match Mastery tak">Mastery</SectionTitle>
        <GlassCard className="p-8 text-center">
          <div className="w-11 h-11 mx-auto mb-3 rounded-xl flex items-center justify-center" style={{ background: "rgba(245,158,11,0.15)" }}>
            <Lock style={{ color: C.gold }} size={20} />
          </div>
          <div className="text-sm font-semibold" style={{ color: C.text }}>Special AI Coaching — paid plans me</div>
          <div className="text-xs mt-1.5 leading-relaxed" style={{ color: C.muted }}>
            Structured roadmap, weekly tests aur mastery gatekeeping ke saath — upgrade karke unlock karo.
          </div>
          <SolidButton tone="gold" className="mt-4" onClick={() => setTab("pricing")}>Upgrade Karo</SolidButton>
        </GlassCard>
      </div>
    );
  }

  const current = getCurrentLevel(profile);
  const label = testCountdownLabel(daysUntilTest(profile));

  return (
    <div className="space-y-4">
      <SectionTitle sub="Har level pass kiye bina agla unlock nahi hota">Mastery Roadmap</SectionTitle>

      {label ? (
        <div className="flex items-center gap-2.5 rounded-2xl px-4 py-3" style={{ background: "rgba(245,158,11,0.1)", border: `1px solid ${C.gold}44` }}>
          <AlarmClock size={16} style={{ color: C.gold }} className="shrink-0" />
          <div className="text-xs font-bold" style={{ color: C.gold }}>{label}</div>
        </div>
      ) : (
        <button
          onClick={async () => { await scheduleNextTest(supabase, user.id); await refreshProfile(); }}
          className="w-full flex items-center gap-2.5 rounded-2xl px-4 py-3 text-left"
          style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${C.border}` }}
        >
          <AlarmClock size={16} style={{ color: C.muted }} className="shrink-0" />
          <div className="text-xs" style={{ color: C.muted }}>Koi test scheduled nahi — apna pehla weekly test schedule karo</div>
        </button>
      )}

      {MASTERY_LEVELS.map((level) => {
        const unlocked = isLevelUnlocked(profile, level.id);
        const passed = isLevelPassed(profile, level.id);
        const isCurrent = current === level.id && !passed;
        return (
          <GlassCard key={level.id} className="p-4" style={!unlocked ? { opacity: 0.55 } : undefined}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-bold flex items-center gap-1.5" style={{ color: C.text }}>
                  {passed ? <CheckCircle2 size={15} style={{ color: C.green }} /> : unlocked ? <PlayCircle size={15} style={{ color: C.gold }} /> : <Lock size={14} style={{ color: C.muted }} />}
                  {level.title}
                </div>
                <div className="text-xs mt-1" style={{ color: C.muted }}>{level.description}</div>
                {level.shotTypes.length > 0 && (
                  <div className="text-[10px] mt-1.5" style={{ color: C.muted }}>Shots: {level.shotTypes.join(", ")}</div>
                )}
                <div className="text-[10px] mt-1" style={{ color: C.muted }}>Pass score: {level.passScore}+</div>
              </div>
              {passed && <span className="shrink-0 text-[9px] font-bold px-2 py-1 rounded-full" style={{ background: C.green, color: "#06110B" }}>PASSED</span>}
              {isCurrent && !passed && <span className="shrink-0 text-[9px] font-bold px-2 py-1 rounded-full" style={{ background: C.gold, color: "#0B0F17" }}>CURRENT</span>}
            </div>
            {unlocked && !passed && (
              <SolidButton tone="dark" className="mt-3 !py-2 text-xs" onClick={() => setTab("analyze")}>
                <PlayCircle size={13} /> Is level ka shot analyze karo
              </SolidButton>
            )}
          </GlassCard>
        );
      })}

      <p className="text-[10px] text-center" style={{ color: C.muted }}>
        Weekly test pass karne par agla level automatically unlock ho jaata hai.
      </p>
    </div>
  );
}
