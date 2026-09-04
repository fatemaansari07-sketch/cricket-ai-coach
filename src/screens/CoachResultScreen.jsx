import React, { useState } from "react";
import { Check, ChevronDown, Flame, Sparkles, TrendingUp, TrendingDown, AlertCircle, Share2, Quote } from "lucide-react";
import { GlassCard, SolidButton, MetricBox, AdSlot, C } from "../components/ui";
import SkeletonOverlay from "../components/SkeletonOverlay";

/**
 * Renders the "PRACTICE → ANALYZE → ONE FOCUS → DRILL" result the way a
 * coach would say it, instead of a raw list of every technical flaw.
 * Everything technical still lives here, just tucked under "Technical details".
 */
export default function CoachResultScreen({ coaching, shotType, onPlanReady, showAd, planTier, onUpgrade, videoThumb }) {
  const [showTech, setShowTech] = useState(false);
  if (!coaching) return null;

  const {
    category, score, whatWentWell = [], mainFocus, why, drills = [], target,
    otherObservations = [], retest, streak, confidence, framesUsed, phases,
    rawCorrect = [], rawIncorrect = [], drillsAreVariant, skeletonLandmarks, jointStatus, handedness,
  } = coaching;

  const showSkeleton = planTier === "pro" && videoThumb && skeletonLandmarks && jointStatus;

  const metrics = phases
    ? [
        { label: "Stance", value: phases.stance },
        { label: "Mid-Shot", value: phases.midShot },
        { label: "Follow-Through", value: phases.followThrough },
        { label: "Overall", value: score },
      ]
    : [{ label: "Overall", value: score }];

  const shareReport = async () => {
    const text = `${category[0].toUpperCase() + category.slice(1)} score: ${score}/100. Main focus: ${mainFocus?.label || "—"}. Next target: ${target}.`;
    if (navigator.share) {
      try { await navigator.share({ title: "Cricket AI Coach — My Session", text }); } catch { /* user cancelled, ignore */ }
    } else {
      try { await navigator.clipboard.writeText(text); alert("Report copy ho gaya, kahi bhi paste kar sakte ho."); } catch { /* clipboard blocked, ignore */ }
    }
  };

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

      {retest?.outcome === "not_improved" && planTier === "basic" && (
        <button
          onClick={onUpgrade}
          className="w-full flex items-center gap-3 rounded-2xl p-3.5 text-left"
          style={{ background: "rgba(245,158,11,0.06)", border: `1px solid ${C.gold}33` }}
        >
          <Sparkles size={16} style={{ color: C.gold }} className="shrink-0" />
          <div className="text-xs" style={{ color: "#D1D5DB" }}>
            <b style={{ color: C.gold }}>Iski wajah camera angle ho sakta hai.</b> Pro Deep Scan poori video dekhta hai, kisi bhi angle se — zyada accurate result milega.
          </div>
        </button>
      )}

      {/* Video hero — a real frame from the uploaded clip, not a stock photo */}
      {videoThumb ? (
        <div className="relative rounded-2xl overflow-hidden" style={{ aspectRatio: "16/10" }}>
          <img src={videoThumb} alt="" className="w-full h-full object-cover" />
          {showSkeleton && <SkeletonOverlay landmarks={skeletonLandmarks} jointStatus={jointStatus} handedness={handedness} />}
          <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(5,7,11,0.92) 0%, rgba(5,7,11,0.15) 55%, transparent 100%)" }} />
          <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold" style={{ background: "rgba(5,7,11,0.7)", color: score >= 80 ? C.green : score >= 65 ? C.gold : C.red, border: `1px solid ${C.border}` }}>
            {score}/100
          </div>
          {showSkeleton && (
            <div className="absolute top-3 left-3 flex items-center gap-2 px-2 py-1 rounded-lg text-[9px] font-bold" style={{ background: "rgba(5,7,11,0.7)" }}>
              <span className="flex items-center gap-1" style={{ color: C.green }}><span className="w-1.5 h-1.5 rounded-full" style={{ background: C.green }} /> SAHI</span>
              <span className="flex items-center gap-1" style={{ color: C.red }}><span className="w-1.5 h-1.5 rounded-full" style={{ background: C.red }} /> GALAT</span>
            </div>
          )}
          <div className="absolute bottom-3 left-4 right-4">
            <div className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: "#D1D5DB" }}>{shotType || category}</div>
            <div className="text-lg font-extrabold" style={{ color: C.text, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              {category[0].toUpperCase() + category.slice(1)} Analysis
            </div>
            {streak > 1 && (
              <div className="flex items-center gap-1 text-xs mt-1 font-semibold" style={{ color: C.gold }}>
                <Flame size={12} /> {streak} din practice streak
              </div>
            )}
          </div>
        </div>
      ) : (
        <GlassCard className="p-5 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: C.muted }}>{shotType || category}</div>
            <div className="text-lg font-extrabold" style={{ color: C.text, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              {category[0].toUpperCase() + category.slice(1)} Analysis
            </div>
            {streak > 1 && (
              <div className="flex items-center gap-1 text-xs mt-1 font-semibold" style={{ color: C.gold }}>
                <Flame size={12} /> {streak} din practice streak
              </div>
            )}
          </div>
          <div className="text-3xl font-extrabold" style={{ color: score >= 80 ? C.green : score >= 65 ? C.gold : C.red }}>{score}</div>
        </GlassCard>
      )}

      {videoThumb && skeletonLandmarks && jointStatus && planTier !== "pro" && (
        <button
          onClick={onUpgrade}
          className="w-full flex items-center gap-2.5 rounded-xl p-3 text-left"
          style={{ background: "rgba(245,158,11,0.06)", border: `1px solid ${C.gold}33` }}
        >
          <Sparkles size={14} style={{ color: C.gold }} className="shrink-0" />
          <span className="text-xs" style={{ color: "#D1D5DB" }}>
            <b style={{ color: C.gold }}>Pro me apna joint-by-joint skeleton dekho</b> — kaunsa hissa sahi hai, kaunsa galat, seedha video par.
          </span>
        </button>
      )}

      {/* 2x2 (or single) metric grid */}
      <div className="grid grid-cols-2 gap-2.5">
        {metrics.map((m) => (
          <MetricBox key={m.label} label={m.label} value={m.value} />
        ))}
      </div>

      {whatWentWell.length > 0 && (
        <GlassCard className="p-4">
          <div className="text-xs font-bold mb-2 flex items-center gap-1.5" style={{ color: C.green }}>
            <Check size={13} /> Aaj kya sahi kiya
          </div>
          <ul className="space-y-1.5">
            {whatWentWell.map((c, i) => (
              <li key={i} className="text-sm flex gap-2" style={{ color: "#D1D5DB" }}><span style={{ color: C.green }}>—</span>{c}</li>
            ))}
          </ul>
        </GlassCard>
      )}

      {/* Coach Notes — quote-style card */}
      <div className="rounded-2xl p-4" style={{ background: C.cardSolid, borderLeft: `3px solid ${C.gold}` }}>
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-bold mb-2" style={{ color: C.gold }}>
          <Quote size={11} /> AI Coach Notes
        </div>
        <p className="text-sm italic leading-relaxed" style={{ color: "#D1D5DB" }}>"{why}"</p>
      </div>

      {/* Correction Plan */}
      <GlassCard className="p-4">
        <div className="text-sm font-extrabold mb-1" style={{ color: C.text }}>
          {mainFocus ? mainFocus.label : "Correction Plan"}
        </div>
        {drills.length > 0 && (
          <>
            <div className="text-[10px] font-semibold uppercase tracking-wide mb-2.5" style={{ color: C.muted }}>
              {drillsAreVariant ? "Naya tareeka — pehle wala kaam nahi kiya" : "Ye karo"}
            </div>
            <ul className="space-y-2.5 mb-3.5">
              {drills.map((d, i) => (
                <li key={i} className="flex gap-2.5 items-start">
                  <span
                    className="shrink-0 w-5 h-5 rounded-md flex items-center justify-center text-[11px] font-extrabold mt-0.5"
                    style={{ background: "rgba(245,158,11,0.15)", color: C.gold }}
                  >
                    {i + 1}
                  </span>
                  <span className="text-sm leading-snug" style={{ color: "#D1D5DB" }}>{d}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        <div className="rounded-xl px-3 py-2.5 flex items-center justify-between" style={{ background: "rgba(255,255,255,0.03)" }}>
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
          {rawCorrect.map((c, i) => <div key={`c${i}`} style={{ color: C.green }}>+ {c}</div>)}
          {rawIncorrect.map((c, i) => <div key={`i${i}`} style={{ color: C.red }}>- {c}</div>)}
        </GlassCard>
      )}

      <p className="text-[10px] text-center" style={{ color: C.muted }}>
        Practice karo, phir 5 balls record karke dubara upload karo — coach check karega improve hua ya nahi.
      </p>

      <div className="flex gap-2.5">
        <SolidButton tone="green" onClick={onPlanReady} className="flex-1">
          30-Day Plan Dekho
        </SolidButton>
        <button
          onClick={shareReport}
          className="shrink-0 w-12 rounded-2xl flex items-center justify-center active:scale-95 transition-transform"
          style={{ background: C.cardSolid, border: `1px solid ${C.border}` }}
          aria-label="Share Report"
        >
          <Share2 size={17} style={{ color: C.text }} />
        </button>
      </div>
    </div>
  );
}
