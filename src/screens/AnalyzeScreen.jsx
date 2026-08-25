// src/screens/AnalyzeScreen.jsx
import React, { useState } from "react";
import { Upload, Play, Sparkles, Check, X, Calendar, AlertCircle, Lock, Camera, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { extractPoseSequenceFromVideo } from "../lib/poseEstimation";
import { evaluatePoseSequence } from "../data/biomechanics";
import { DAILY_LIMITS, SHOT_TYPES, needsQuotaReset } from "../data/limits";
import { C, GlassCard, SolidButton, AdSlot, ScoreRing, Pill, SectionTitle } from "../components/ui";
import { determineMainFocus } from "../lib/priorityEngine";

export default function AnalyzeScreen({ isPaid, onPlanReady, setTab, onRetest }) {
  const { user, profile, refreshProfile } = useAuth();
  const [category, setCategory] = useState("batting");
  const [handedness, setHandedness] = useState("right");
  const [shotType, setShotType] = useState(SHOT_TYPES.batting[0]);
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [step, setStep] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showResultAd, setShowResultAd] = useState(false);
  const [useGemini, setUseGemini] = useState(false);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  const planTier = profile?.plan_tier ?? "free";
  const isProUser = planTier === "pro";
  const isFree = planTier === "free";
  const isAcademyLinked = !!profile?.academy_id;
  const heavyAds = isFree && !isAcademyLinked;

  const usedToday = needsQuotaReset(profile) ? 0 : (profile?.videos_analyzed_today ?? 0);
  const limit = DAILY_LIMITS[planTier] ?? DAILY_LIMITS.free;
  const quotaLeft = Math.max(0, limit - usedToday);
  const quotaHit = quotaLeft <= 0;

  const changeCategory = (c) => {
    setCategory(c);
    setShotType(SHOT_TYPES[c][0]);
    setResult(null);
  };

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (f) { setFile(f); setResult(null); setError(null); }
  };

  const bumpQuota = async () => {
    const today = new Date().toISOString().slice(0, 10);
    const newCount = needsQuotaReset(profile) ? 1 : (profile?.videos_analyzed_today ?? 0) + 1;
    await supabase
      .from("profiles")
      .update({ videos_analyzed_today: newCount, videos_quota_reset_at: today })
      .eq("id", user.id);
    await refreshProfile();
  };

  const analyze = async () => {
    if (!file || !user || quotaHit) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      setStep("Video upload ho raha hai...");
      const path = `${user.id}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from("videos").upload(path, file);
      if (uploadError) throw uploadError;

      const { data: videoRow, error: videoError } = await supabase
        .from("videos")
        .insert({ user_id: user.id, storage_path: path, category, shot_type: shotType })
        .select()
        .single();
      if (videoError) throw videoError;

      let r;

      if (isProUser && useGemini) {
        setStep("Gemini AI video dekh raha hai...");
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        const res = await fetch("/api/analyze-video-gemini", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ storagePath: path, category, shotType, handedness }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Gemini analysis fail ho gayi.");
        r = { 
          category: json.category, 
          score: json.score, 
          correct: json.correct || [], 
          incorrect: json.incorrect || [], 
          confidence: json.confidence === "high" ? "high" : json.confidence === "medium" ? "medium" : "low",
          flaws: (json.incorrect || []).map(item => ({ flaw: item, rootCause: item, type: "GENERAL" }))
        };

        await supabase.from("analyses").insert({
          video_id: videoRow.id,
          user_id: user.id,
          category: r.category,
          score: r.score,
          correct_points: r.correct,
          incorrect_points: r.incorrect,
          pose_keypoints: { cameraAngleDetected: json.cameraAngleDetected },
          model_version: "gemini-1.5-flash",
        });
      } else {
        setStep("Poori shot ke 10 frames check kar raha hai...");
        const frames = await extractPoseSequenceFromVideo(file, 10);
        if (!frames || frames.length === 0) {
          throw new Error("Video me poora body clearly nahi dikha. Achhi lighting me, poora body frame me rakh ke dubara try karo.");
        }

        setStep("Cricket coaching rules laga raha hai...");
        r = evaluatePoseSequence(frames, category, handedness);
        
        // Map detected incorrect points into Priority Engine flaw format
        r.flaws = (r.incorrect || []).map(item => ({ flaw: item, rootCause: item, type: "GENERAL" }));

        await supabase.from("analyses").insert({
          video_id: videoRow.id,
          user_id: user.id,
          category: r.category,
          score: r.score,
          correct_points: r.correct,
          incorrect_points: r.incorrect,
          pose_keypoints: { angles: r.angles },
          model_version: "pose-rules-v1",
        });
      }

      await bumpQuota();
      setResult(r);
      setShowResultAd(heavyAds);
    } catch (err) {
      setError(err.message || "Kuch galat ho gaya, dubara try karo.");
    } finally {
      setLoading(false);
      setStep("");
    }
  };

  // Run priority engine on calculated flaws
  const coachingFocus = result ? determineMainFocus(result.flaws) : null;

  return (
    <div className="space-y-4">
      <SectionTitle sub="Ek shot select karo, video daalo, AI dekhega kya sahi kya galat hai">Analyze & Coach</SectionTitle>

      <div className="flex items-start gap-2 rounded-xl p-3" style={{ background: "rgba(16,185,129,0.06)", border: `1px solid ${C.green}33` }}>
        <Camera size={15} style={{ color: C.green }} className="shrink-0 mt-0.5" />
        <div className="text-xs" style={{ color: "#D1D5DB" }}>
          <b style={{ color: C.text }}>Best result ke liye: Side-on (square-leg) se shoot karo</b> — samne ya peeche se video me elbow/head ka angle galat measure ho sakta hai.
        </div>
      </div>

      <div className="flex items-center justify-between text-xs" style={{ color: C.muted }}>
        <span>Aaj ka quota</span>
        <span style={{ color: quotaHit ? C.red : C.text, fontWeight: 600 }}>{usedToday}/{limit} used</span>
      </div>

      <div className="flex gap-2">
        {["batting", "bowling", "fielding"].map((c) => (
          <Pill key={c} active={category === c} onClick={() => changeCategory(c)}>
            {c[0].toUpperCase() + c.slice(1)}
          </Pill>
        ))}
      </div>

      <select
        value={shotType}
        onChange={(e) => setShotType(e.target.value)}
        className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none"
        style={{ background: "rgba(0,0,0,0.3)", border: `1px solid ${C.border}`, color: C.text }}
      >
        {(isFree ? SHOT_TYPES[category].slice(0, 2) : SHOT_TYPES[category]).map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      {isFree && (
        <p className="text-[10px]" style={{ color: C.muted }}>
          Free me {SHOT_TYPES[category].slice(0, 2).join(" aur ")} hi milte hain — <button onClick={() => setTab("pricing")} style={{ color: C.gold, textDecoration: "underline" }}>upgrade</button> karke sab shots unlock karo.
        </p>
      )}
      {heavyAds && <AdSlot label="Sponsored" />}

      <div className="flex gap-2">
        <Pill active={handedness === "right"} onClick={() => setHandedness("right")}>Right-handed</Pill>
        <Pill active={handedness === "left"} onClick={() => setHandedness("left")}>Left-handed</Pill>
      </div>

      {isProUser && (
        <button
          onClick={() => setUseGemini((v) => !v)}
          className="w-full flex items-center justify-between rounded-xl p-3.5"
          style={{ background: C.cardSolid, border: `1px solid ${useGemini ? C.gold : C.border}` }}
        >
          <div className="text-left">
            <div className="text-sm font-semibold" style={{ color: C.text }}>Pro Deep Scan</div>
            <div className="text-[11px] mt-0.5" style={{ color: C.muted }}>Poori video dekhta hai, kisi bhi camera angle se — sabse accurate</div>
          </div>
          <div className="w-11 h-6 rounded-full flex items-center px-0.5 shrink-0" style={{ background: useGemini ? C.gold : C.border }}>
            <div className="w-5 h-5 rounded-full bg-white transition-transform" style={{ transform: useGemini ? "translateX(20px)" : "translateX(0)" }} />
          </div>
        </button>
      )}

      {quotaHit ? (
        <GlassCard className="p-6 text-center">
          <Lock className="mx-auto mb-2" size={20} style={{ color: C.gold }} />
          <div className="text-sm font-semibold" style={{ color: C.text }}>Aaj ka free limit khatam</div>
          <div className="text-xs mt-1" style={{ color: C.muted }}>Kal wapas try karo, ya upgrade karke aur zyada analyses paao.</div>
          <SolidButton tone="gold" className="mt-4" onClick={() => setTab("pricing")}>Upgrade Karo</SolidButton>
        </GlassCard>
      ) : (
        <>
          <label className="block rounded-2xl p-7 text-center cursor-pointer backdrop-blur-md" style={{ border: `2px dashed ${C.border}`, background: "rgba(255,255,255,0.02)" }}>
            <input type="file" accept="video/*" className="hidden" onChange={handleFile} />
            <div className="w-11 h-11 mx-auto mb-3 rounded-xl flex items-center justify-center" style={{ background: C.green }}>
              <Upload style={{ color: "#06110B" }} size={20} />
            </div>
            <div className="text-sm font-semibold" style={{ color: C.text }}>
              {file ? file.name : `${shotType} video select karo`}
            </div>
            <div className="text-xs mt-1" style={{ color: C.muted }}>Chhota focused clip (10-15 sec), poora body frame me</div>
          </label>

          {heavyAds && <AdSlot label="Sponsored" />}

          <SolidButton disabled={!file || loading} onClick={analyze} tone="green">
            {loading ? <Sparkles size={16} className="animate-pulse" /> : <Play size={16} />}
            {loading ? (step || "Analyze ho raha hai...") : "Analyze Karo"}
          </SolidButton>
        </>
      )}

      {error && (
        <div className="flex items-start gap-2 text-xs rounded-xl p-3" style={{ background: "rgba(239,68,68,0.08)", color: C.red, border: `1px solid ${C.red}33` }}>
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* RESULT DISPLAY WITH AI COACHING FOCUS */}
      {result && (
        <div className="space-y-4 pt-2">
          {showResultAd && <AdSlot label="Sponsored — result page" />}

          {result.confidence !== "high" && (
            <div className="flex items-start gap-2 text-xs rounded-xl p-3" style={{ background: "rgba(245,158,11,0.08)", color: C.gold, border: `1px solid ${C.gold}33` }}>
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>
                {result.confidence === "low" ? "Confidence: Low — " : "Confidence: Medium — "}
                body clearly nahi dikha. Side-on video se dubara try karo.
              </span>
            </div>
          )}

          {/* Core Score Ring Header */}
          <GlassCard className="p-5 flex items-center gap-4">
            <ScoreRing score={result.score} />
            <div>
              <div className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: C.muted }}>{shotType} Score</div>
              <div className="text-lg font-extrabold" style={{ color: C.text }}>
                {result.category[0].toUpperCase() + result.category.slice(1)} Session
              </div>
              <div className="text-xs mt-0.5" style={{ color: C.green, fontWeight: 600 }}>
                Coaching Priority Target Ready
              </div>
            </div>
          </GlassCard>

          {/* NEW COACHING HERO CARD: ONE MAIN FOCUS */}
          {coachingFocus && (
            <GlassCard className="p-5 border-2" style={{ borderColor: C.gold, background: "rgba(245,158,11,0.04)" }}>
              <div className="text-[10px] uppercase tracking-widest font-bold mb-1 flex items-center gap-1" style={{ color: C.gold }}>
                <span>🎯 TODAY'S MAIN FOCUS</span>
              </div>
              <div className="text-xl font-black mb-2" style={{ color: C.text }}>
                {coachingFocus.mainFocus}
              </div>
              <div className="text-xs mb-4 leading-relaxed" style={{ color: C.muted }}>
                <b>Kyu zaroori hai:</b> {coachingFocus.whyItMatters}
              </div>

              <div className="space-y-2 pt-2 border-t" style={{ borderColor: C.border }}>
                <div className="text-xs font-bold uppercase tracking-wider" style={{ color: C.text }}>Recommended Drills:</div>
                {coachingFocus.drills.map((drill, index) => (
                  <div key={index} className="flex items-center justify-between p-2.5 rounded-lg text-xs" style={{ background: C.cardSolid, border: `1px solid ${C.border}` }}>
                    <span className="font-semibold" style={{ color: C.text }}>{index + 1}. {drill.name}</span>
                    <span className="font-mono text-[11px] px-2 py-0.5 rounded" style={{ background: "rgba(16,185,129,0.1)", color: C.green }}>{drill.reps}</span>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}

          {/* Re-test CTA */}
          <SolidButton tone="green" onClick={onRetest || (() => setFile(null))}>
            Practice Complete? Re-Test Now 🔄
          </SolidButton>

          {/* Secondary Details Accordion */}
          <div className="pt-1">
            <button
              onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
              className="w-full flex justify-between items-center py-2.5 text-xs font-semibold border-b"
              style={{ color: C.muted, borderColor: C.border }}
            >
              <span>DETAILED TECHNICAL OBSERVATIONS</span>
              {showTechnicalDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showTechnicalDetails && (
              <div className="mt-3 space-y-3">
                {result.phases && (
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {[
                      { label: "Stance", value: result.phases.stance },
                      { label: "Mid-shot", value: result.phases.midShot },
                      { label: "Follow-through", value: result.phases.followThrough },
                    ].map((p) => (
                      <div key={p.label} className="rounded-xl p-2 text-center" style={{ background: C.cardSolid, border: `1px solid ${C.border}` }}>
                        <div className="text-[9px] uppercase mb-0.5" style={{ color: C.muted }}>{p.label}</div>
                        <div className="text-xs font-bold" style={{ color: p.value >= 70 ? C.green : C.gold }}>{p.value}</div>
                      </div>
                    ))}
                  </div>
                )}

                {result.correct.length > 0 && (
                  <GlassCard className="p-3">
                    <div className="text-xs font-bold mb-2 flex items-center gap-1.5" style={{ color: C.green }}>
                      <Check size={14} /> Sahi Point
                    </div>
                    <ul className="space-y-1 text-xs" style={{ color: C.muted }}>
                      {result.correct.map((c, i) => (
                        <li key={i}>• {c}</li>
                      ))}
                    </ul>
                  </GlassCard>
                )}

                {result.incorrect.length > 0 && (
                  <GlassCard className="p-3">
                    <div className="text-xs font-bold mb-2 flex items-center gap-1.5" style={{ color: C.red }}>
                      <X size={14} /> Improvement Area
                    </div>
                    <ul className="space-y-1 text-xs" style={{ color: C.muted }}>
                      {result.incorrect.map((c, i) => (
                        <li key={i}>• {c}</li>
                      ))}
                    </ul>
                  </GlassCard>
                )}
              </div>
            )}
          </div>

          <SolidButton tone="gold" onClick={() => { onPlanReady(result); setTab("plan"); }}>
            <Calendar size={16} /> 30-Day Detailed Plan
          </SolidButton>
        </div>
      )}
    </div>
  );
}
