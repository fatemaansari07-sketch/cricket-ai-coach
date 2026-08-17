import React, { useState } from "react";
import { Upload, Play, Sparkles, Check, X, Calendar, AlertCircle, Lock } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { extractPoseFromVideo } from "../lib/poseEstimation";
import { evaluatePose } from "../data/biomechanics";
import { DAILY_LIMITS, SHOT_TYPES, needsQuotaReset } from "../data/limits";
import { C, GlassCard, SolidButton, AdSlot, ScoreRing, Pill, SectionTitle } from "../components/ui";

export default function AnalyzeScreen({ isPaid, onPlanReady, setTab }) {
  const { user, profile, refreshProfile } = useAuth();
  const [category, setCategory] = useState("batting");
  const [shotType, setShotType] = useState(SHOT_TYPES.batting[0]);
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [step, setStep] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showResultAd, setShowResultAd] = useState(false);

  const planTier = profile?.plan_tier ?? "free";
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
      setStep("Body ke joints dhoondh raha hai...");
      const landmarks = await extractPoseFromVideo(file);
      if (!landmarks) {
        throw new Error("Video me poora body clearly nahi dikha. Achhi lighting me, poora body frame me rakh ke dubara try karo.");
      }

      setStep("Cricket coaching rules laga raha hai...");
      const r = evaluatePose(landmarks, category);

      setStep("Save kar raha hai...");
      const path = `${user.id}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from("videos").upload(path, file);
      if (uploadError) throw uploadError;

      const { data: videoRow, error: videoError } = await supabase
        .from("videos")
        .insert({ user_id: user.id, storage_path: path, category, shot_type: shotType })
        .select()
        .single();
      if (videoError) throw videoError;

      const { error: analysisError } = await supabase.from("analyses").insert({
        video_id: videoRow.id,
        user_id: user.id,
        category: r.category,
        score: r.score,
        correct_points: r.correct,
        incorrect_points: r.incorrect,
        pose_keypoints: { angles: r.angles },
        model_version: "pose-rules-v1",
      });
      if (analysisError) throw analysisError;

      await bumpQuota();
      setResult(r);
      setShowResultAd(heavyAds); // second ad, right when the result reveals
    } catch (err) {
      setError(err.message || "Kuch galat ho gaya, dubara try karo.");
    } finally {
      setLoading(false);
      setStep("");
    }
  };

  return (
    <div className="space-y-4">
      <SectionTitle sub="Ek shot select karo, video daalo, AI dekhega kya sahi kya galat hai">Analyze</SectionTitle>

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
        {SHOT_TYPES[category].map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>

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

      {result && (
        <div className="space-y-4 pt-2">
          {showResultAd && <AdSlot label="Sponsored — result page" />}

          <GlassCard className="p-5 flex items-center gap-4">
            <ScoreRing score={result.score} />
            <div>
              <div className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: C.muted }}>{shotType} Score</div>
              <div className="text-lg font-extrabold" style={{ color: C.text, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                {result.category[0].toUpperCase() + result.category.slice(1)} Analysis
              </div>
              <div className="text-xs mt-0.5" style={{ color: C.muted }}>Aage ka 30-day plan neeche ready hai</div>
            </div>
          </GlassCard>

          {result.correct.length > 0 && (
            <GlassCard className="p-4">
              <div className="text-sm font-bold mb-2.5 flex items-center gap-1.5" style={{ color: C.green }}>
                <Check size={15} /> Sahi kya hai — iska fayda
              </div>
              <ul className="space-y-2">
                {result.correct.map((c, i) => (
                  <li key={i} className="text-sm flex gap-2" style={{ color: "#D1D5DB" }}><span style={{ color: C.green }}>—</span>{c}</li>
                ))}
              </ul>
            </GlassCard>
          )}

          {result.incorrect.length > 0 && (
            <GlassCard className="p-4">
              <div className="text-sm font-bold mb-2.5 flex items-center gap-1.5" style={{ color: C.red }}>
                <X size={15} /> Sudharna kya hai — nahi sudhara to kya hoga
              </div>
              <ul className="space-y-2">
                {result.incorrect.map((c, i) => (
                  <li key={i} className="text-sm flex gap-2" style={{ color: "#D1D5DB" }}><span style={{ color: C.red }}>—</span>{c}</li>
                ))}
              </ul>
            </GlassCard>
          )}

          <SolidButton tone="gold" onClick={() => { onPlanReady(result); setTab("plan"); }}>
            <Calendar size={16} /> 30-Day Plan Banao
          </SolidButton>
        </div>
      )}
    </div>
  );
}
