import React, { useState } from "react";
import { Check, ChevronDown, Flame, Sparkles, TrendingUp, TrendingDown, AlertCircle, Share2, Quote } from "lucide-react";
import { GlassCard, SolidButton, MetricBox, AdSlot, C } from "../components/ui";
import SkeletonOverlay from "../components/SkeletonOverlay";
import VideoAnalysisOverlay from "../components/VideoAnalysisOverlay";
import { renderAnnotatedVideo } from "../lib/videoCoachRenderer";
import { consumeVideoCredit, getVideoCreditStatus } from "../lib/videoCredits";
import { supabase } from "../lib/supabaseClient";

/**
 * Renders the "PRACTICE → ANALYZE → ONE FOCUS → DRILL" result the way a
 * coach would say it, instead of a raw list of every technical flaw.
 * Everything technical still lives here, just tucked under "Technical details".
 */
export default function CoachResultScreen({
  coaching, shotType, onPlanReady, showAd, planTier, onUpgrade,
  videoThumb, videoThumbAspect, videoThumbNeutral,
  stanceThumb, stanceThumbAspect, stanceThumbNeutral,
  followThroughThumb, followThroughThumbAspect, followThroughThumbNeutral,
  annotatedVideoUrl, analysisFile, analysisFrames, ballTrack, phaseDetection, profile, onCreditsChanged,
}) {
  const [showTech, setShowTech] = useState(false);
  const [generatingVideo, setGeneratingVideo] = useState(false);
  const [videoUrl, setVideoUrl] = useState(annotatedVideoUrl || null);
  const [videoMessage, setVideoMessage] = useState("");
  if (!coaching) return null;

  const {
    category, score, whatWentWell = [], mainFocus, why, drills = [], target,
    otherObservations = [], retest, streak, confidence, framesUsed, phases,
    rawCorrect = [], rawIncorrect = [], drillsAreVariant, skeletonLandmarks, jointStatus, jointDetail, handedness,
    stanceSkeleton, followThroughSkeleton, ballLine,
  } = coaching;

  const showSkeleton = true;

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

  const hasAnyThumb = videoThumb || stanceThumb || followThroughThumb;

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

      {/* Stance → Impact → Follow-Through — one frozen frame can't judge a
          shot fairly (looks fine at contact, falls apart after), so we show
          the real sequence. Swipeable on mobile; all positioning here is
          inline style, not Tailwind, so it never depends on a build's class
          list — this box must render correctly every single time. */}
      {analysisFile && analysisFrames?.length > 0 && (
        <VideoAnalysisOverlay file={analysisFile} frames={analysisFrames} category={category} handedness={handedness} ballTrack={ballTrack} />
      )}

      {ballLine && (
        <GlassCard className="p-4">
          <div className="text-xs font-bold mb-2.5 flex items-center gap-1.5" style={{ color: C.text }}>
            🎯 Ball Line & Length <span className="font-normal" style={{ color: C.muted }}>(track ki gayi delivery se)</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl p-2.5 text-center" style={{ background: "rgba(255,255,255,0.04)" }}>
              <div className="text-[9px] uppercase tracking-wide font-semibold mb-1" style={{ color: C.muted }}>Line</div>
              <div className="text-[11px] font-bold" style={{ color: C.text }}>{ballLine.line}</div>
            </div>
            <div className="rounded-xl p-2.5 text-center" style={{ background: "rgba(255,255,255,0.04)" }}>
              <div className="text-[9px] uppercase tracking-wide font-semibold mb-1" style={{ color: C.muted }}>Length</div>
              <div className="text-[11px] font-bold" style={{ color: C.text }}>{ballLine.length}</div>
            </div>
            <div className="rounded-xl p-2.5 text-center" style={{ background: "rgba(255,255,255,0.04)" }}>
              <div className="text-[9px] uppercase tracking-wide font-semibold mb-1" style={{ color: C.muted }}>Swing</div>
              <div className="text-[11px] font-bold" style={{ color: C.text }}>{ballLine.swing}</div>
            </div>
          </div>
          <div className="text-[10px] mt-2.5" style={{ color: C.muted }}>
            Phone camera se visual estimate hai — radar/Hawkeye jaisi lab-grade precision nahi, par asli tracked ball path se nikala gaya hai.
          </div>
        </GlassCard>
      )}

      {planTier !== "free" && (() => {
        const cs = getVideoCreditStatus(planTier, profile);
        return <GlassCard className="p-4">
          <div className="text-sm font-extrabold" style={{ color: C.text }}>🎥 Coaching Video chahiye?</div>
          <div className="text-xs mt-1" style={{ color: C.muted }}>Har analysis ke baad tumhari permission zaroori hai. Video tabhi banega jab tum <b style={{ color: C.text }}>Generate</b> dabaaoge.</div>
          <div className="text-[10px] mt-2" style={{ color: C.gold }}>Monthly credits: {cs.remaining}/{cs.limit}</div>
          <div className="flex gap-2 mt-3">
            <SolidButton tone="gold" disabled={generatingVideo || cs.remaining <= 0} onClick={async()=>{
              setGeneratingVideo(true);setVideoMessage("Video ban raha hai... kuch seconds lagenge.");
              try {
                const made=await renderAnnotatedVideo(analysisFile,analysisFrames,{professional:planTier==='pro',category,handedness,ballTrack,phaseDetection});
                if(!made) throw new Error("Is browser me video recording supported nahi hai.");
                const consumed=await consumeVideoCredit(supabase);
                if(!consumed.allowed) throw new Error("Video credit available nahi hai.");
                setVideoUrl(made);setVideoMessage(`Video ready — ${consumed.remaining} credit bacha.`);onCreditsChanged?.();
              } catch(e){setVideoMessage(e.message||"Video nahi ban paya.");}
              finally{setGeneratingVideo(false);}
            }} className="flex-1">{generatingVideo?"Generating...":"Generate Coaching Video"}</SolidButton>
            <button onClick={()=>setVideoMessage("Theek hai — video nahi banaya. Koi credit use nahi hua.")} className="px-4 rounded-2xl text-xs font-bold" style={{background:C.cardSolid,border:`1px solid ${C.border}`,color:C.text}}>Not now</button>
          </div>
          {videoMessage && <div className="text-[10px] mt-2" style={{color:C.muted}}>{videoMessage}</div>}
        </GlassCard>;
      })()}

      {videoUrl && (
        <GlassCard className="p-3">
          <div className="text-xs font-extrabold mb-2" style={{ color: C.text }}>🎥 AI Movement Replay</div>
          <video src={videoUrl} controls playsInline className="w-full rounded-xl" style={{ background: "#000" }} />
          <div className="text-[10px] mt-2" style={{ color: C.muted }}>Original video + pitch lane + ball trajectory + tappa + skeleton + correct/wrong coaching overlay.</div>
        </GlassCard>
      )}

      {hasAnyThumb ? (
        <div>
          <div style={{ display: "flex", gap: 10, overflowX: "auto", scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch", paddingBottom: 4 }}>
            <PhaseFrame
              label="Stance" thumb={stanceThumb} aspect={stanceThumbAspect}
              skeleton={stanceSkeleton} handedness={handedness} showSkeleton={showSkeleton}
              phaseScore={phases?.stance} neutralColor={stanceThumbNeutral}
            />
            <PhaseFrame
              label="Impact / Contact" thumb={videoThumb} aspect={videoThumbAspect}
              skeleton={{ landmarks: skeletonLandmarks, jointStatus, jointDetail }} handedness={handedness} showSkeleton={showSkeleton}
              phaseScore={phases?.midShot ?? score} neutralColor={videoThumbNeutral}
            />
            <PhaseFrame
              label="Follow-Through" thumb={followThroughThumb} aspect={followThroughThumbAspect}
              skeleton={followThroughSkeleton} handedness={handedness} showSkeleton={showSkeleton}
              phaseScore={phases?.followThrough} neutralColor={followThroughThumbNeutral}
            />
          </div>
          {(stanceThumb || followThroughThumb) && (
            <div className="text-[10px] text-center mt-1.5" style={{ color: C.muted }}>← Swipe: Stance · Impact · Follow-Through →</div>
          )}

          <div className="flex items-center justify-between mt-3">
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

      {ballTrack?.points?.length >= 4 && (
        <GlassCard className="p-4">
          <div className="text-xs font-extrabold" style={{ color: C.text }}>🏏 Ball Track</div>
          <div className="grid grid-cols-3 gap-2 mt-2">
            <MetricBox label="Tracked" value={ballTrack.points.length} />
            <MetricBox label="Tappa" value={ballTrack.trajectory?.bouncePoint ? "✓" : "—"} />
            <MetricBox label="Confidence" value={ballTrack.confidence || "low"} />
          </div>
          <div className="text-[10px] mt-2" style={{color:C.muted}}>Orange curve release se bounce/tappa aur aage ball ki direction dikhati hai. Weak track par app number guess nahi karta.</div>
        </GlassCard>
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

/** One frame in the Stance / Impact / Follow-Through strip. */
function PhaseFrame({ label, thumb, aspect, skeleton, handedness, showSkeleton, phaseScore, neutralColor }) {
  if (!thumb) return null;
  const hasSkeleton = showSkeleton && skeleton?.landmarks && skeleton?.jointStatus;
  return (
    <div
      style={{
        position: "relative", flex: "0 0 82%", scrollSnapAlign: "start",
        aspectRatio: aspect || "3/4", maxHeight: "62vh", borderRadius: 14, overflow: "hidden", background: "#000",
      }}
    >
      <img src={thumb} alt="" style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: aspect ? "contain" : "cover" }} />
      {hasSkeleton && <SkeletonOverlay landmarks={skeleton.landmarks} jointStatus={skeleton.jointStatus} jointDetail={skeleton.jointDetail} handedness={handedness} neutralColor={neutralColor} />}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, padding: "8px 10px", background: "linear-gradient(to bottom, rgba(5,7,11,0.85), transparent)" }}>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", color: C.text, textTransform: "uppercase" }}>{label}</span>
      </div>
      {phaseScore != null && (
        <div style={{ position: "absolute", top: 8, right: 8, padding: "3px 8px", borderRadius: 8, fontSize: 11, fontWeight: 800, background: "rgba(5,7,11,0.75)", color: phaseScore >= 80 ? C.green : phaseScore >= 65 ? C.gold : C.red }}>
          {phaseScore}
        </div>
      )}
      {hasSkeleton && (
        <div style={{ position: "absolute", bottom: 8, left: 8, display: "flex", gap: 6, padding: "3px 7px", borderRadius: 8, fontSize: 8, fontWeight: 700, background: "rgba(5,7,11,0.75)" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 3, color: C.green }}><span style={{ width: 5, height: 5, borderRadius: 999, background: C.green }} /> SAHI</span>
          <span style={{ display: "flex", alignItems: "center", gap: 3, color: C.red }}><span style={{ width: 5, height: 5, borderRadius: 999, background: C.red }} /> GALAT</span>
        </div>
      )}
    </div>
  );
}
