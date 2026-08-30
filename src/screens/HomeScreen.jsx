import React from "react";
import { Video, Calendar, ArrowLeftRight, Upload, Crown, Sparkles, School } from "lucide-react";
import { C, GlassCard, AdSlot } from "../components/ui";
import TodaysPracticeCard from "../components/TodaysPracticeCard";

export default function HomeScreen({ isPaid, planTier, isAcademyOwner, setTab }) {
  const quickActions = [
    { icon: <Video size={18} />, label: "Analyze", tab: "analyze" },
    { icon: <Calendar size={18} />, label: "30-Day Plan", tab: "plan" },
    { icon: <ArrowLeftRight size={18} />, label: "Compare", tab: "compare" },
  ];

  const planLabel = planTier === "free" ? "Free plan" : planTier === "basic" ? "Basic · ₹99/mo" : "Pro · ₹299/mo";

  return (
    <div className="space-y-5">
      <div
        className="relative rounded-3xl overflow-hidden p-6"
        style={{ border: `1px solid ${C.border}`, background: `linear-gradient(135deg, ${C.greenDeep} 0%, #0E1420 55%, #000000 100%)` }}
      >
        <div className="relative">
          <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-bold mb-3" style={{ color: C.green }}>
            <Sparkles size={11} /> Your Personal Coach
          </div>
          <h1 className="text-[28px] leading-tight font-extrabold tracking-tight" style={{ color: C.text, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Apna practice video daalo,<br />sudhaar dekho.
          </h1>
          <p className="text-sm mt-3 leading-relaxed max-w-[90%]" style={{ color: C.muted }}>
            Batting, bowling ya fielding — video daalo aur AI batayega kya sahi hai, kya sudharna hai.
          </p>
          <button
            onClick={() => setTab("analyze")}
            className="mt-5 flex items-center gap-2 font-bold px-5 py-3 rounded-2xl text-sm active:scale-95 transition-transform"
            style={{ background: C.green, color: "#06110B" }}
          >
            <Upload size={16} /> Video Analyze Karo
          </button>
        </div>
      </div>

      <TodaysPracticeCard setTab={setTab} />

      <div className="grid grid-cols-3 gap-3">
        {quickActions.map((it) => (
          <button
            key={it.tab}
            onClick={() => setTab(it.tab)}
            className="flex flex-col items-center gap-2.5 rounded-2xl py-4 active:scale-95 transition-transform"
            style={{ background: C.card, border: `1px solid ${C.border}` }}
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(16,185,129,0.12)", color: C.green }}>
              {it.icon}
            </div>
            <span className="text-[11px] font-semibold tracking-wide" style={{ color: C.text }}>{it.label}</span>
          </button>
        ))}
      </div>

      <div
        className="rounded-2xl px-4 py-3.5 flex items-center justify-between"
        style={{ background: C.cardSolid, border: `1px solid ${planTier === "free" ? `${C.gold}55` : C.border}` }}
      >
        <div>
          <div className="text-sm font-bold" style={{ color: C.text }}>{planLabel}</div>
          <div className="text-xs mt-0.5" style={{ color: C.muted }}>{isPaid ? "Ads hidden, quota badhi hui hai" : "Ads dikhenge free features me"}</div>
        </div>
        {planTier !== "pro" && (
          <button
            onClick={() => setTab("pricing")}
            className="text-[11px] font-bold px-3.5 py-2 rounded-xl flex items-center gap-1 shrink-0 active:scale-95 transition-transform"
            style={{ background: C.gold, color: "#0B0F17" }}
          >
            <Crown size={13} /> Upgrade
          </button>
        )}
      </div>

      {!isPaid && <AdSlot />}

      {!isAcademyOwner && (
        <button
          onClick={() => setTab("academy")}
          className="w-full flex items-center gap-3 rounded-2xl p-4 active:scale-95 transition-transform"
          style={{ background: C.cardSolid, border: `1px solid ${C.border}` }}
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(16,185,129,0.12)" }}>
            <School size={18} style={{ color: C.green }} />
          </div>
          <div className="text-left">
            <div className="text-sm font-bold" style={{ color: C.text }}>Coach ho? Apni academy free me shuru karo</div>
            <div className="text-xs mt-0.5" style={{ color: C.muted }}>Students ka poora progress data ek jagah — bilkul free</div>
          </div>
        </button>
      )}
    </div>
  );
}
