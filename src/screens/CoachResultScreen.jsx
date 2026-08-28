import React, { useState } from "react";
import { Check, ChevronDown, Flame, Sparkles, TrendingUp, TrendingDown, AlertCircle } from "lucide-react";
import { GlassCard, SolidButton, ScoreRing, AdSlot, C } from "../components/ui";

/**
 * Renders the "PRACTICE → ANALYZE → ONE FOCUS → DRILL" result the way a
 * coach would say it, instead of a raw list of every technical flaw.
 * Everything technical still lives here, just tucked under "Technical details".
 */
export default function CoachResultScreen({ coaching, shotType, onPlanReady, showAd }) {
  const [showTech, setShowTech] = useState(false);
  if (!coaching) return null;

  const {
    category, score, whatWentWell = [], mainFocus, why, drills = [], target,
    otherObservations = [], retest, streak, confidence, framesUsed, phases,
    rawCorrect = [], rawIncorrect = [],
  } = coaching;

  return (
    <div className="space-y-4 pt-2">
      {showAd && <AdSlot label="Sponsored — result page" />}

      {confidence && confidence !== "high" && (
        <div className="flex items-start gap-2 text-xs rounded-xl p-3" style={{ background: "rgba(245,158,11,0.08)", color: C.gold, border: `1px solid ${C.gold}33` }}>
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <span>
            Confidence: {confidence} — body clearly nahi dikha (angle/lighting issue ho sakta hai). Side-on, poori roshni me dubara try karo, result zyada accurate aayega.
          </span>
        </div>
      )}

      {retest && (
        <div
          className="rounded-2xl p-4 flex items-center gap-3"
          style={{
            background: retest.outcome === "improved" ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.08)",
            border: `1px solid ${retest.outcome === "improved" ? C.green : C.red}55`,
          }}
        >
          {retest.outcome === "improved"
            ? <TrendingUp size={20} style={{ color: C.green }} />
            : <TrendingDown size={20} style={{ color: C.red }} />}
          <div>
            <div className="text-sm font-bold" style={{ color: retest.outcome === "improved" ? C.green : C.red }}>
              {retest.outcome === "improved" ? "IMPROVED — badhiya!" : "ABHI FIX NAHI HUA"}
            </div>
            <div className="text-xs mt-0.5" style={{ color: C.muted }}>
              {retest.delta != null ? `Score change: ${retest.delta >= 0 ? "+" : ""}${retest.delta}. ` : ""}
              {retest.outcome === "improved" ? "Agla focus set ho gaya hai neeche." : "Isi cheez par thoda aur kaam karo — drills neeche same rakhe hain."}
            </div>
          </div>
        </div>
      )}

      <GlassCard className="p-5 flex items-center gap-4">
        <ScoreRing score={score} />
        <div>
          <div className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: C.muted }}>{shotType || category} Score</div>
          <div className="text-lg font-extrabold" style={{ color: C.text, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            {category[0].toUpperCase() + category.slice(1)} Session
          </div>
          {streak > 1 && (
            <div className="flex items-center gap-1 text-xs mt-1 font-semibold" style={{ color: C.gold }}>
              <Flame size={12} /> {streak} din practice streak
            </div>
          )}
        </div>
      </GlassCard>

      {whatWentWell.length > 0 && (
        <GlassCard className="p-4">
          <div className="text-sm font-bold mb-2.5 flex items-center gap-1.5" style={{ color: C.green }}>
            <Check size={15} /> Aaj kya sahi kiya
          </div>
          <ul className="space-y-2">
            {whatWentWell.map((c, i) => (
              <li key={i} className="text-sm flex gap-2" style={{ color: "#D1D5DB" }}><span style={{ color: C.green }}>—</span>{c}</li>
            ))}
          </ul>
        </GlassCard>
      )}

      <GlassCard className="p-4" style={{ border: `1px solid ${C.gold}55` }}>
        <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-bold mb-2" style={{ color: C.gold }}>
          <Sparkles size={11} /> Aaj Ka Main Focus
        </div>
        <div className="text-base font-extrabold mb-1.5" style={{ color: C.text }}>
          {mainFocus ? mainFocus.label : "Sab kuch theek hai"}
        </div>
        <div className="text-sm mb-3 leading-relaxed" style={{ color: "#D1D5DB" }}>{why}</div>

        {drills.length > 0 && (
          <>
            <div className="text-xs font-bold mb-1.5" style={{ color: C.muted }}>Ye karo:</div>
            <ul className="space-y-1.5 mb-3">
              {drills.map((d, i) => (
                <li key={i} className="text-sm flex gap-2" style={{ color: "#D1D5DB" }}>
                  <span style={{ color: C.gold }} className="font-bold">{i + 1}.</span>{d}
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="rounded-xl px-3 py-2.5 flex items-center justify-between" style={{ background: C.cardSolid }}>
          <span className="text-xs" style={{ color: C.muted }}>Next target</span>
          <span className="text-sm font-extrabold" style={{ color: C.green }}>{score} → {target}</span>
        </div>
      </GlassCard>

      {otherObservations.length > 0 && (
        <details className="rounded-2xl px-4 py-3" style={{ background: C.cardSolid, border: `1px solid ${C.border}` }}>
          <summary className="text-xs font-semibold cursor-pointer" style={{ color: C.muted }}>
            Other observations ({otherObservations.length}) — inpar abhi focus mat karo
          </summary>
          <ul className="space-y-1.5 mt-2">
            {otherObservations.map((o, i) => (
              <li key={i} className="text-xs" style={{ color: C.muted }}>— {o}</li>
            ))}
          </ul>
        </details>
      )}

      <button onClick={() => setShowTech((v) => !v)} className="w-full flex items-center justify-between text-xs px-1 py-2" style={{ color: C.muted }}>
        Technical details
        <ChevronDown size={14} style={{ transform: showTech ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
      </button>
      {showTech && (
        <GlassCard className="p-4 text-xs space-y-2">
          {framesUsed ? <div style={{ color: C.muted }}>{framesUsed} frames analyzed</div> : null}
          {phases && (
            <div className="grid grid-cols-3 gap-2 py-1">
              {[["Stance", phases.stance], ["Mid-shot", phases.midShot], ["Follow-through", phases.followThrough]].map(([label, val]) => (
                <div key={label} className="rounded-lg p-2 text-center" style={{ background: C.cardSolid }}>
                  <div className="text-[9px] uppercase" style={{ color: C.muted }}>{label}</div>
                  <div className="text-sm font-bold" style={{ color: val >= 70 ? C.green : C.gold }}>{val}</div>
                </div>
              ))}
            </div>
          )}
          {rawCorrect.map((c, i) => <div key={`c${i}`} style={{ color: C.green }}>+ {c}</div>)}
          {rawIncorrect.map((c, i) => <div key={`i${i}`} style={{ color: C.red }}>- {c}</div>)}
        </GlassCard>
      )}

      <p className="text-[10px] text-center" style={{ color: C.muted }}>
        Practice karo, phir 5 balls record karke dubara upload karo — coach check karega improve hua ya nahi.
      </p>

      <SolidButton tone="gold" onClick={onPlanReady}>
        30-Day Plan Dekho
      </SolidButton>
    </div>
  );
}
