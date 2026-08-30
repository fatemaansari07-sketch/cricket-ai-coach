import React, { useState } from "react";
import { Upload, Play, Sparkles, AlertCircle, Lock, Camera } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { extractPoseSequenceFromVideo } from "../lib/poseEstimation";
import { evaluatePoseSequence } from "../data/biomechanics";
import { DAILY_LIMITS, SHOT_TYPES, needsQuotaReset } from "../data/limits";
import { issuesFromGeminiIncorrect } from "../lib/priorityEngine";
import { runCoachingLoop } from "../lib/coachSession";
import CoachResultScreen from "./CoachResultScreen";
import { C, GlassCard, SolidButton, AdSlot, Pill, SectionTitle, InfoHint, SettingsCard } from "../components/ui";

export default function AnalyzeScreen({ isPaid, onPlanReady, setTab }) {
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

  const planTier = profile?.plan_tier ?? "free";
  const isProUser = planTier === "pro";
  const isFree = planTier === "free";
  const isAcademyLinked = !!profile?.academy_id;
  // Free + no academy => heavier ad flow (2 ads per analysis). Academy-linked free
  // students get a much lighter experience since academies bring bulk users.
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
      // Upload happens either way — Gemini path needs it in Storage to read from.
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
      let analysisRow;

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
        r = { category: json.category, score: json.score, correct: json.correct, incorrect: json.incorrect, confidence: json.confidence === "high" ? "high" : json.confidence === "medium" ? "medium" : "low" };
        r.issues = issuesFromGeminiIncorrect(r.incorrect, r.category);

        const { data: inserted } = await supabase.from("analyses").insert({
          video_id: videoRow.id,
          user_id: user.id,
          category: r.category,
          score: r.score,
          correct_points: r.correct,
          incorrect_points: r.incorrect,
          issues: r.issues,
          pose_keypoints: { cameraAngleDetected: json.cameraAngleDetected },
          model_version: "gemini-1.5-flash",
        }).select().single();
        analysisRow = inserted;
      } else {
        setStep("Poori shot ke 10 frames check kar raha hai...");
        const frames = await extractPoseSequenceFromVideo(file, 10);
        if (!frames || frames.length === 0) {
          throw new Error("Video me poora body clearly nahi dikha. Achhi lighting me, poora body frame me rakh ke dubara try karo.");
        }

        setStep("Cricket coaching rules laga raha hai...");
        r = evaluatePoseSequence(frames, category, handedness);

        const { data: inserted } = await supabase.from("analyses").insert({
          video_id: videoRow.id,
          user_id: user.id,
          category: r.category,
          score: r.score,
          correct_points: r.correct,
          incorrect_points: r.incorrect,
          issues: r.issues || [],
          pose_keypoints: { angles: r.angles },
          model_version: "pose-rules-v1",
        }).select().single();
        analysisRow = inserted;
      }

      await bumpQuota();
      const coaching = await runCoachingLoop({
        supabase, user, category, analysisId: analysisRow.id, evalResult: r,
      });
      setResult(coaching);
      setShowResultAd(heavyAds); // second ad, right when the result reveals
    } catch (err) {
      setError(err.message || "Kuch galat ho gaya, dubara try karo.");
    } finally {
      setLoading(false);
      setStep("");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <SectionTitle sub="Ek shot select karo, video daalo, AI dekhega kya sahi kya galat hai">Analyze</SectionTitle>
        <span
          className="shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full mt-0.5"
          style={{ color: quotaHit ? C.red : C.muted, background: "rgba(255,255,255,0.04)" }}
        >
          {usedToday}/{limit}
        </span>
      </div>

      <InfoHint icon={Camera}>
        Side-on (square-leg) se shoot karo — samne/peeche se angle galat measure ho sakta hai.
      </InfoHint>

      <SettingsCard>
        <div className="flex gap-2">
          {["batting", "bowling", "fielding"].map((c) => (
            <Pill key={c} active={category === c} onClick={() => changeCategory(c)}>
              {c[0].toUpperCase() + c.slice(1)}
            </Pill>
          ))}
        </div>

        <div>
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
            <p className="text-[10px] mt-1.5" style={{ color: C.muted }}>
              Free me sirf {SHOT_TYPES[category].slice(0, 2).join(" aur ")} — <button onClick={() => setTab("pricing")} style={{ color: C.gold, fontWeight: 600 }}>upgrade karo</button>
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <Pill active={handedness === "right"} onClick={() => setHandedness("right")}>Right-handed</Pill>
          <Pill active={handedness === "left"} onClick={() => setHandedness("left")}>Left-handed</Pill>
        </div>

        {isProUser && (
          <button onClick={() => setUseGemini((v) => !v)} className="w-full flex items-center justify-between">
            <div className="text-left">
              <div className="text-sm font-semibold" style={{ color: C.text }}>Pro Deep Scan</div>
              <div className="text-[11px] mt-0.5" style={{ color: C.muted }}>Kisi bhi camera angle se, sabse accurate</div>
            </div>
            <div className="w-11 h-6 rounded-full flex items-center px-0.5 shrink-0" style={{ background: useGemini ? C.gold : C.border }}>
              <div className="w-5 h-5 rounded-full bg-white transition-transform" style={{ transform: useGemini ? "translateX(20px)" : "translateX(0)" }} />
            </div>
          </button>
        )}
      </SettingsCard>

      {heavyAds && <AdSlot label="Sponsored" />}

      {quotaHit ? (
        <GlassCard className="p-6 text-center">
          <Lock className="mx-auto mb-2" size={20} style={{ color: C.gold }} />
          <div className="text-sm font-semibold" style={{ color: C.text }}>Aaj ka free limit khatam</div>
          <div className="text-xs mt-1" style={{ color: C.muted }}>Kal wapas try karo, ya upgrade karke aur zyada analyses paao.</div>
          <SolidButton tone="gold" className="mt-4" onClick={() => setTab("pricing")}>Upgrade Karo</SolidButton>
        </GlassCard>
      ) : (
        <>
          <label className="block rounded-2xl p-6 text-center cursor-pointer" style={{ border: `1.5px dashed ${C.border}`, background: "rgba(255,255,255,0.02)" }}>
            <input type="file" accept="video/*" className="hidden" onChange={handleFile} />
            <Upload size={22} className="mx-auto mb-2" style={{ color: file ? C.green : C.muted }} />
            <div className="text-sm font-semibold" style={{ color: C.text }}>
              {file ? file.name : `${shotType} video select karo`}
            </div>
            <div className="text-xs mt-1" style={{ color: C.muted }}>10-15 sec, poora body frame me</div>
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

      {result && (
        <CoachResultScreen
          coaching={result}
          shotType={shotType}
          showAd={showResultAd}
          onPlanReady={() => {
            onPlanReady({
              category: result.category,
              incorrect: [result.mainFocus?.label, ...(result.otherObservations || [])].filter(Boolean),
            });
            setTab("plan");
          }}
        />
      )}
    </div>
  );
}
