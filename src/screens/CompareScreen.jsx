import React, { useState } from "react";
import { Lock, Upload, Play, Sparkles, Tag, AlertCircle, Camera } from "lucide-react";
import { extractPoseSequenceFromVideo, LM } from "../lib/poseEstimation";
import { evaluatePoseSequence, compareAngles } from "../data/biomechanics";
import { C, GlassCard, SolidButton, StickFigure, Pill, SectionTitle } from "../components/ui";

function VideoPicker({ label, file, onChange }) {
  return (
    <label className="block rounded-2xl p-4 text-center cursor-pointer backdrop-blur-md" style={{ border: `2px dashed ${C.border}`, background: "rgba(255,255,255,0.02)" }}>
      <input type="file" accept="video/*" className="hidden" onChange={(e) => onChange(e.target.files?.[0] || null)} />
      <Upload className="mx-auto mb-1.5" size={18} style={{ color: C.green }} />
      <div className="text-xs font-semibold" style={{ color: C.text }}>{label}</div>
      <div className="text-[10px] mt-0.5 truncate" style={{ color: C.muted }}>{file ? file.name : "Tap to select"}</div>
    </label>
  );
}

// Rough mapping from normalized MediaPipe landmarks to our stick-figure SVG proportions
function landmarksToFigureProps(landmarks) {
  const nose = landmarks[LM.NOSE];
  const lShoulder = landmarks[LM.LEFT_SHOULDER];
  const rShoulder = landmarks[LM.RIGHT_SHOULDER];
  const lHip = landmarks[LM.LEFT_HIP];
  const midShoulder = { x: (lShoulder.x + rShoulder.x) / 2, y: (lShoulder.y + rShoulder.y) / 2 };
  const tilt = Math.max(-30, Math.min(30, ((nose.x - midShoulder.x) / (midShoulder.y - nose.y || 0.01)) * 40));
  const kneeBend = Math.max(0, Math.min(20, (lHip.x - midShoulder.x) * 60));
  return { tilt: Math.round(tilt), kneeBend: Math.round(kneeBend) };
}

export default function CompareScreen({ planTier }) {
  const canBasicCompare = planTier !== "free";
  const canProCompare = planTier === "pro";

  const [category, setCategory] = useState("batting");
  const [fileA, setFileA] = useState(null);
  const [fileB, setFileB] = useState(null);
  const [refLabel, setRefLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [resultA, setResultA] = useState(null);
  const [resultB, setResultB] = useState(null);

  if (!canBasicCompare) {
    return (
      <div className="space-y-4">
        <SectionTitle sub="Apna video aur koi bhi reference video daalo, side-by-side compare karo">Compare</SectionTitle>
        <GlassCard className="p-8 text-center">
          <div className="w-11 h-11 mx-auto mb-3 rounded-xl flex items-center justify-center" style={{ background: "rgba(245,158,11,0.15)" }}>
            <Lock style={{ color: C.gold }} size={20} />
          </div>
          <div className="text-sm font-semibold" style={{ color: C.text }}>Ye feature paid plans me hai</div>
          <div className="text-xs mt-1.5 leading-relaxed" style={{ color: C.muted }}>₹99/mo se apne do videos compare karo, ya ₹299/mo me detailed joint-by-joint breakdown ke saath.</div>
        </GlassCard>
      </div>
    );
  }

  const runCompare = async () => {
    if (!fileA || !fileB) return;
    setLoading(true);
    setError(null);
    setResultA(null);
    setResultB(null);
    try {
      const [framesA, framesB] = await Promise.all([
        extractPoseSequenceFromVideo(fileA, 10),
        extractPoseSequenceFromVideo(fileB, 10),
      ]);
      if (!framesA?.length || !framesB?.length) {
        throw new Error("Kisi ek video me body clearly nahi dikha. Achhi lighting me, poora body frame me rakh ke dubara try karo.");
      }
      const midA = framesA[Math.floor(framesA.length / 2)].landmarks;
      const midB = framesB[Math.floor(framesB.length / 2)].landmarks;
      setResultA({ eval: evaluatePoseSequence(framesA, category), figure: landmarksToFigureProps(midA) });
      setResultB({ eval: evaluatePoseSequence(framesB, category), figure: landmarksToFigureProps(midB) });
    } catch (err) {
      setError(err.message || "Kuch galat ho gaya, dubara try karo.");
    } finally {
      setLoading(false);
    }
  };

  const breakdown = resultA && resultB ? compareAngles(resultA.eval.angles, resultB.eval.angles) : null;

  return (
    <div className="space-y-4">
      <SectionTitle sub="Apna video aur koi bhi reference video daalo — dono khud upload karo">Compare</SectionTitle>

      <div className="flex items-start gap-2 rounded-xl p-3" style={{ background: "rgba(16,185,129,0.06)", border: `1px solid ${C.green}33` }}>
        <Camera size={15} style={{ color: C.green }} className="shrink-0 mt-0.5" />
        <div className="text-xs" style={{ color: "#D1D5DB" }}>
          <b style={{ color: C.text }}>Dono videos side-on (square-leg) se shoot karo</b> — sabse accurate comparison milega.
        </div>
      </div>

      <div className="flex gap-2">
        {["batting", "bowling", "fielding"].map((c) => (
          <Pill key={c} active={category === c} onClick={() => setCategory(c)}>{c[0].toUpperCase() + c.slice(1)}</Pill>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <VideoPicker label="Apna Video" file={fileA} onChange={setFileA} />
        <VideoPicker label="Reference Video" file={fileB} onChange={setFileB} />
      </div>

      {canProCompare && (
        <input
          value={refLabel}
          onChange={(e) => setRefLabel(e.target.value)}
          placeholder="Reference video kiska hai? (optional, jaise 'Virat cover drive')"
          className="w-full rounded-xl px-3.5 py-2.5 text-xs outline-none"
          style={{ background: "rgba(0,0,0,0.3)", border: `1px solid ${C.border}`, color: C.text }}
        />
      )}

      <SolidButton disabled={!fileA || !fileB || loading} onClick={runCompare} tone="green">
        {loading ? <Sparkles size={16} className="animate-pulse" /> : <Play size={16} />}
        {loading ? "Dono videos analyze ho rahe hain..." : "Compare Karo"}
      </SolidButton>

      {error && (
        <div className="flex items-start gap-2 text-xs rounded-xl p-3" style={{ background: "rgba(239,68,68,0.08)", color: C.red, border: `1px solid ${C.red}33` }}>
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {resultA && resultB && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <GlassCard className="p-3">
              <div className="text-xs font-semibold mb-1 text-center" style={{ color: C.muted }}>Apna Video · Score {resultA.eval.score}</div>
              <StickFigure tilt={resultA.figure.tilt} kneeBend={resultA.figure.kneeBend} color={C.gold} />
            </GlassCard>
            <GlassCard className="p-3">
              <div className="text-xs font-semibold mb-1 text-center" style={{ color: C.muted }}>{refLabel || "Reference"} · Score {resultB.eval.score}</div>
              <StickFigure tilt={resultB.figure.tilt} kneeBend={resultB.figure.kneeBend} color={C.green} />
            </GlassCard>
          </div>

          {(resultA.eval.confidence !== "high" || resultB.eval.confidence !== "high") && (
            <div className="flex items-start gap-2 text-xs rounded-xl p-3" style={{ background: "rgba(245,158,11,0.08)", color: C.gold, border: `1px solid ${C.gold}33` }}>
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>Ek ya dono videos me body clearly nahi dikha (confidence low/medium) — result approximate ho sakta hai.</span>
            </div>
          )}

          <GlassCard className="p-4 space-y-3">
            <div className="text-sm font-bold mb-1" style={{ color: C.text }}>Joint-by-joint breakdown</div>
            {breakdown.map((j, i) => (
              <div key={i} className="text-xs flex gap-2" style={{ color: "#D1D5DB" }}>
                <Tag size={12} style={{ color: C.gold }} className="mt-0.5 shrink-0" />
                <span>
                  <b style={{ color: C.text }}>{j.joint}:</b> Apna video {j.a}° · Reference {j.b}°
                  {j.diff != null && (
                    <span style={{ color: Math.abs(j.diff) <= 5 ? C.green : C.red }}> ({j.diff > 0 ? "+" : ""}{j.diff}° farak)</span>
                  )}
                </span>
              </div>
            ))}
          </GlassCard>

          <p className="text-[10px] text-center" style={{ color: C.muted }}>
            Dono videos khud upload kiye gaye hain — app koi player footage store/provide nahi karta.
          </p>
        </>
      )}
    </div>
  );
}
