import React, { useState } from "react";
import { Upload, Play, Sparkles, AlertCircle, Lock, Camera } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { extractPoseSequenceFromVideo, captureFrameDataUrl, LM } from "../lib/poseEstimation";
import { evaluatePoseSequence } from "../data/biomechanics";
import { DAILY_LIMITS, SHOT_TYPES, needsQuotaReset } from "../data/limits";
import { issuesFromGeminiIncorrect } from "../lib/priorityEngine";
import { runCoachingLoop } from "../lib/coachSession";
import { trackBallFromPoseFrames, analyzeBallLine } from "../lib/ballTracking";
import CoachResultScreen from "./CoachResultScreen";
import { C, GlassCard, SolidButton, AdSlot, Pill, InfoHint, SettingsCard } from "../components/ui";

export default function AnalyzeScreen({ isPaid, onPlanReady, setTab }) {
  const { user, profile, refreshProfile } = useAuth();
  const [started, setStarted] = useState(false);
  const [category, setCategory] = useState("batting");
  const [handedness, setHandedness] = useState("right");
  const [shotType, setShotType] = useState(SHOT_TYPES.batting[0]);
  const [file, setFile] = useState(null);
  const [videoThumb, setVideoThumb] = useState(null);
  const [videoThumbAspect, setVideoThumbAspect] = useState(null);
  const [videoThumbNeutral, setVideoThumbNeutral] = useState(null);
  const [stanceThumb, setStanceThumb] = useState(null);
  const [stanceThumbAspect, setStanceThumbAspect] = useState(null);
  const [stanceThumbNeutral, setStanceThumbNeutral] = useState(null);
  const [followThroughThumb, setFollowThroughThumb] = useState(null);
  const [followThroughThumbAspect, setFollowThroughThumbAspect] = useState(null);
  const [followThroughThumbNeutral, setFollowThroughThumbNeutral] = useState(null);
  const [result, setResult] = useState(null);
  const [step, setStep] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showResultAd, setShowResultAd] = useState(false);
  const [useGemini, setUseGemini] = useState(false);
  const [annotatedVideoUrl, setAnnotatedVideoUrl] = useState(null);
  const [ballTrack, setBallTrack] = useState(null);

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
    if (!f) return;
    setFile(f);
    setResult(null);
    if (annotatedVideoUrl) URL.revokeObjectURL(annotatedVideoUrl);
    setAnnotatedVideoUrl(null);
    setError(null);
    setBallTrack(null);
    setVideoThumb(null);
    setVideoThumbAspect(null);
    setVideoThumbNeutral(null);
    setStanceThumb(null);
    setStanceThumbAspect(null);
    setStanceThumbNeutral(null);
    setFollowThroughThumb(null);
    setFollowThroughThumbAspect(null);
    setFollowThroughThumbNeutral(null);

    // Grab a real frame ~1s in as the result-screen hero image. Best-effort:
    // if this fails for any reason (codec, browser quirk), we just skip the
    // hero image and the result screen falls back to a plain card.
    try {
      const url = URL.createObjectURL(f);
      const videoEl = document.createElement("video");
      videoEl.src = url;
      videoEl.muted = true;
      videoEl.playsInline = true;
      videoEl.addEventListener("loadeddata", () => {
        videoEl.currentTime = Math.min(1, (videoEl.duration || 2) * 0.3);
      });
      videoEl.addEventListener("seeked", () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = videoEl.videoWidth;
          canvas.height = videoEl.videoHeight;
          canvas.getContext("2d").drawImage(videoEl, 0, 0);
          setVideoThumb(canvas.toDataURL("image/jpeg", 0.85));
          setVideoThumbAspect(videoEl.videoWidth / videoEl.videoHeight);
        } catch {
          // silently skip — hero image is a nice-to-have, not required
        }
        URL.revokeObjectURL(url);
      });
    } catch {
      // older browsers / unsupported format — no thumbnail, no big deal
    }
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
          model_version: "gemini-2.5-flash",
        }).select().single();
        analysisRow = inserted;
      } else {
        setStep("Poori shot ke 10 frames check kar raha hai...");
        const durationHint = file?.size > 30 * 1024 * 1024 ? 24 : 32;
        const frames = await extractPoseSequenceFromVideo(file, durationHint, null, category);
        if (!frames || frames.length === 0) {
          throw new Error("Video me poora body clearly nahi dikha. Achhi lighting me, poora body frame me rakh ke dubara try karo.");
        }

        setStep("Ball, pitch lane aur movement track kar raha hai...");
        const trackedBall = trackBallFromPoseFrames(frames);
        setBallTrack(trackedBall);
        setStep("Cricket coaching rules laga raha hai...");
        r = evaluatePoseSequence(frames, category, handedness);
        r.analysisFrames = frames;
        r.ballTrack = trackedBall;
        r.pitchTrack = trackedBall?.trajectory?.points || [];

        // Line/length/swing read of the delivery — from the SAME tracked
        // trajectory, judged against where the batsman was actually
        // standing (not a screen-center guess).
        if (r.skeletonLandmarks) {
          const hipL = r.skeletonLandmarks[LM.LEFT_HIP], hipR = r.skeletonLandmarks[LM.RIGHT_HIP];
          const ankleL = r.skeletonLandmarks[LM.LEFT_ANKLE], ankleR = r.skeletonLandmarks[LM.RIGHT_ANKLE];
          const batsmanX = hipL && hipR ? (hipL.x + hipR.x) / 2 : null;
          const feetY = ankleL && ankleR ? (ankleL.y + ankleR.y) / 2 : null;
          r.ballLine = analyzeBallLine(trackedBall?.trajectory, batsmanX, feetY);
        }

        // Capture all THREE phase frames — stance, impact, follow-through —
        // not just one. A single frozen frame can't show a batting shot
        // fairly (e.g. looks great at contact but the follow-through falls
        // apart), so the result screen shows the real sequence.
        const captureAligned = async (atSeconds, landmarks) => {
          if (atSeconds == null) return null;
          try {
            const c = await captureFrameDataUrl(file, atSeconds, landmarks);
            return { dataUrl: c.dataUrl, aspect: c.width / c.height, neutral: c.neutralColor };
          } catch {
            return null;
          }
        };

        const midShot = await captureAligned(r.skeletonAtSeconds, r.skeletonLandmarks);
        if (midShot) { setVideoThumb(midShot.dataUrl); setVideoThumbAspect(midShot.aspect); setVideoThumbNeutral(midShot.neutral); }

        const stanceShot = await captureAligned(r.stanceSkeleton?.atSeconds, r.stanceSkeleton?.landmarks);
        if (stanceShot) { setStanceThumb(stanceShot.dataUrl); setStanceThumbAspect(stanceShot.aspect); setStanceThumbNeutral(stanceShot.neutral); }

        const ftShot = await captureAligned(r.followThroughSkeleton?.atSeconds, r.followThroughSkeleton?.landmarks);
        if (ftShot) { setFollowThroughThumb(ftShot.dataUrl); setFollowThroughThumbAspect(ftShot.aspect); setFollowThroughThumbNeutral(ftShot.neutral); }

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
      // IMPORTANT: never generate/download a coaching video automatically.
      // Paid users are asked after every analysis; they can choose Generate
      // or Not now. This prevents surprise credit consumption.
      coaching.analysisFile = file;
      coaching.analysisFrames = r.analysisFrames || [];
      coaching.ballTrack = r.ballTrack || null;
      coaching.phaseDetection = r.phaseDetection || null;
      coaching.videoCreditPlan = planTier;
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
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-2xl font-extrabold tracking-tight" style={{ color: C.text, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Analyze</h2>
        <span
          className="shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full"
          style={{ color: quotaHit ? C.red : C.muted, background: "rgba(255,255,255,0.04)" }}
        >
          {usedToday}/{limit}
        </span>
      </div>
      <p className="text-xs -mt-2" style={{ color: C.muted }}>Ek shot select karo, video daalo, AI dekhega kya sahi kya galat hai</p>

      <InfoHint icon={Camera}>
        Side-on (square-leg) se shoot karo — samne/peeche se angle galat measure ho sakta hai.
      </InfoHint>

      {quotaHit ? (
        <GlassCard className="p-6 text-center">
          <Lock className="mx-auto mb-2" size={20} style={{ color: C.gold }} />
          <div className="text-sm font-semibold" style={{ color: C.text }}>Aaj ka free limit khatam</div>
          <div className="text-xs mt-1" style={{ color: C.muted }}>Kal wapas try karo, ya upgrade karke aur zyada analyses paao.</div>
          <SolidButton tone="gold" className="mt-4" onClick={() => setTab("pricing")}>Upgrade Karo</SolidButton>
        </GlassCard>
      ) : !started ? (
        <div className="flex flex-col items-center text-center py-10 gap-5">
          <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "rgba(16,185,129,0.12)" }}>
            <Play size={26} style={{ color: C.green }} className="ml-1" />
          </div>
          <div>
            <div className="text-base font-bold" style={{ color: C.text }}>Naya session shuru karo</div>
            <div className="text-xs mt-1 max-w-[240px]" style={{ color: C.muted }}>Shot select karo, video daalo, AI turant dekhega</div>
          </div>
          <button
            onClick={() => setStarted(true)}
            className="px-8 py-4 rounded-2xl font-bold text-sm active:scale-95 transition-transform shadow-lg"
            style={{ background: C.green, color: "#06110B" }}
          >
            Analysis Shuru Karo
          </button>
        </div>
      ) : (
        <>
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

          <label className="block rounded-2xl p-6 text-center cursor-pointer" style={{ border: `1.5px dashed ${C.border}`, background: "rgba(255,255,255,0.02)" }}>
            <input type="file" accept="video/*" className="hidden" onChange={handleFile} />
            <Upload size={22} className="mx-auto mb-2" style={{ color: file ? C.green : C.muted }} />
            <div className="text-sm font-semibold" style={{ color: C.text }}>
              {file ? file.name : `${shotType} video select karo`}
            </div>
            <div className="text-xs mt-1" style={{ color: C.muted }}>10-15 sec, poora body frame me • side-on best</div>
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
          planTier={planTier}
          videoThumb={videoThumb}
          videoThumbAspect={videoThumbAspect}
          videoThumbNeutral={videoThumbNeutral}
          stanceThumb={stanceThumb}
          stanceThumbAspect={stanceThumbAspect}
          stanceThumbNeutral={stanceThumbNeutral}
          followThroughThumb={followThroughThumb}
          followThroughThumbAspect={followThroughThumbAspect}
          followThroughThumbNeutral={followThroughThumbNeutral}
          annotatedVideoUrl={annotatedVideoUrl}
          analysisFile={file}
          analysisFrames={result.analysisFrames}
          ballTrack={result.ballTrack}
          phaseDetection={result.phaseDetection}
          profile={profile}
          onCreditsChanged={refreshProfile}
          onUpgrade={() => setTab("pricing")}
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
