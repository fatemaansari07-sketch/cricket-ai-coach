import React, { useEffect, useState } from "react";
import { Target, Play } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { getTodaysPractice } from "../lib/coachSession";
import { C, GlassCard, SolidButton } from "./ui";

export default function TodaysPracticeCard({ setTab }) {
  const { user } = useAuth();
  const [practice, setPractice] = useState(undefined); // undefined = loading, null = none yet

  useEffect(() => {
    let alive = true;
    if (!user) return;
    getTodaysPractice(supabase, user.id).then((p) => { if (alive) setPractice(p); });
    return () => { alive = false; };
  }, [user]);

  if (practice === undefined) return null; // don't flash empty state while loading

  if (!practice) {
    return (
      <GlassCard className="p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(16,185,129,0.15)" }}>
          <Target size={18} style={{ color: C.green }} />
        </div>
        <div className="text-left">
          <div className="text-sm font-bold" style={{ color: C.text }}>Pehla video analyze karo</div>
          <div className="text-xs mt-0.5" style={{ color: C.muted }}>Tabhi coach tumhara "today's practice" bana payega</div>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="p-4" style={{ border: `1px solid ${C.gold}55` }}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-bold mb-2" style={{ color: C.gold }}>
        <Target size={12} /> Today's Practice
      </div>
      <div className="text-base font-extrabold" style={{ color: C.text }}>{practice.focusLabel}</div>
      <div className="text-xs mt-1" style={{ color: C.muted }}>
        {practice.category[0].toUpperCase() + practice.category.slice(1)} · Current {practice.currentScore} → Target {practice.target}
      </div>

      {practice.drills.length > 0 && (
        <ul className="mt-3 space-y-1">
          {practice.drills.map((d, i) => (
            <li key={i} className="text-xs flex gap-2" style={{ color: "#D1D5DB" }}>
              <span style={{ color: C.gold }}>{i + 1}.</span>{d}
            </li>
          ))}
        </ul>
      )}

      <SolidButton tone="gold" className="mt-3.5" onClick={() => setTab("analyze")}>
        <Play size={15} /> Start Practice
      </SolidButton>
    </GlassCard>
  );
}
