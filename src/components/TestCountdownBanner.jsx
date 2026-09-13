import React from "react";
import { AlarmClock } from "lucide-react";
import { C } from "./ui";
import { daysUntilTest, testCountdownLabel } from "../lib/testSchedule";

export default function TestCountdownBanner({ profile, setTab }) {
  const label = testCountdownLabel(daysUntilTest(profile));
  if (!label) return null;
  return (
    <button
      onClick={() => setTab?.("mastery")}
      className="w-full flex items-center gap-2.5 rounded-2xl px-4 py-3 text-left active:scale-[0.98] transition-transform"
      style={{ background: "rgba(245,158,11,0.1)", border: `1px solid ${C.gold}44` }}
    >
      <AlarmClock size={16} style={{ color: C.gold }} className="shrink-0" />
      <div>
        <div className="text-xs font-bold" style={{ color: C.gold }}>{label}</div>
        <div className="text-[10px]" style={{ color: C.muted }}>Weekly mastery test — Mastery tab me submit karo</div>
      </div>
    </button>
  );
}
