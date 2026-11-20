import React, { useEffect, useState } from "react";
import { Upload, Trash2 } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { extractPoseSequenceFromVideo } from "../lib/poseEstimation";
import { extractPhaseAngles, PHASES, JOINTS, CAMERA_ANGLES } from "../lib/referenceLibrary";
import { safeFileName } from "../lib/safeFileName";
import { SHOT_TYPES } from "../data/limits";
import { C, GlassCard, SolidButton } from "./ui";

const sel = { background: "#0B1220", color: "#fff", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, padding: "10px 12px", width: "100%" };

export default function ReferenceLibraryAdmin() {
  const { user } = useAuth();
  const [category, setCategory] = useState("batting");
  const [shotType, setShotType] = useState(SHOT_TYPES.batting[0]);
  const [camera, setCamera] = useState("side-on");
  const [hand, setHand] = useState("right");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [preview, setPreview] = useState(null);
  const [rows, setRows] = useState([]);

  const load = async () => {
    const { data } = await supabase.from("reference_shots").select("id, category, shot_type, camera_angle, created_at").order("created_at", { ascending: false });
    setRows(data || []);
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { setShotType(SHOT_TYPES[category][0]); }, [category]);

  const analyze = async () => {
    if (!file) return;
    setBusy("Video analyze ho raha hai..."); setMsg(""); setPreview(null);
    try {
      const frames = await extractPoseSequenceFromVideo(file, 32, null, category);
      if (!frames?.length) throw new Error("Video me body clearly nahi dikha.");
      setPreview(extractPhaseAngles(frames, category, hand));
    } catch (e) { setMsg(e.message || String(e)); }
    finally { setBusy(""); }
  };

  const save = async () => {
    if (!preview || !file) return;
    setBusy("Save ho raha hai..."); setMsg("");
    try {
      const path = `${user.id}/${Date.now()}-${safeFileName(file.name)}`;
      const up = await supabase.storage.from("reference-videos").upload(path, file, { contentType: file.type || "video/mp4" });
      if (up.error) throw up.error;
      const { error } = await supabase.from("reference_shots").insert({
        category, shot_type: shotType, camera_angle: camera, handedness: hand,
        phase_angles: preview.phases, video_path: path, created_by: user.id,
      });
      if (error) throw error;
      setMsg("Reference save ho gaya."); setPreview(null); setFile(null);
      load();
    } catch (e) { setMsg("Save nahi hua: " + (e.message || e)); }
    finally { setBusy(""); }
  };

  const remove = async (id) => {
    await supabase.from("reference_shots").delete().eq("id", id);
    load();
  };

  const counts = rows.reduce((m, r) => { const k = `${r.shot_type} · ${r.camera_angle}`; m[k] = (m[k] || 0) + 1; return m; }, {});

  return (
    <div className="space-y-4">
      <GlassCard className="p-4 space-y-3">
        <div className="text-sm font-bold" style={{ color: C.text }}>Reference shot add karo</div>
        <div className="text-[11px]" style={{ color: C.muted }}>Ye videos sirf admin ko dikhte hain. Users ko sirf coaching result milta hai.</div>
        <select style={sel} value={category} onChange={(e) => setCategory(e.target.value)}>
          {Object.keys(SHOT_TYPES).map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select style={sel} value={shotType} onChange={(e) => setShotType(e.target.value)}>
          {SHOT_TYPES[category].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select style={sel} value={camera} onChange={(e) => setCamera(e.target.value)}>
          {CAMERA_ANGLES.map((c) => <option key={c} value={c}>Camera: {c}</option>)}
        </select>
        <select style={sel} value={hand} onChange={(e) => setHand(e.target.value)}>
          <option value="right">Right-handed player</option>
          <option value="left">Left-handed player</option>
        </select>
        <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: C.text }}>
          <Upload size={16} /> {file ? file.name : "Video select karo"}
          <input type="file" accept="video/*" hidden onChange={(e) => { setFile(e.target.files?.[0] || null); setPreview(null); }} />
        </label>
        <SolidButton onClick={analyze} disabled={!file || !!busy}>{busy || "Analyze karo"}</SolidButton>
        {preview && (
          <div className="text-[11px] space-y-1" style={{ color: C.text }}>
            <div style={{ color: C.muted }}>Phase detection confidence: {preview.confidence}. Galat lage to doosra clear video lo.</div>
            {Object.entries(PHASES).map(([p, label]) => (
              <div key={p}>{label} ({preview.times[p]?.toFixed?.(2)}s): {Object.entries(JOINTS).map(([j, jl]) => `${jl} ${preview.phases[p][j] ?? "—"}°`).join(" · ")}</div>
            ))}
            <SolidButton onClick={save} disabled={!!busy}>Reference me save karo</SolidButton>
          </div>
        )}
        {msg && <div className="text-xs" style={{ color: C.gold }}>{msg}</div>}
      </GlassCard>

      <GlassCard className="p-4 space-y-2">
        <div className="text-sm font-bold" style={{ color: C.text }}>Library ({rows.length} videos)</div>
        <div className="text-[11px]" style={{ color: C.muted }}>Har shot + camera angle ke kam se kam 5 videos rakho.</div>
        {Object.entries(counts).map(([k, n]) => <div key={k} className="text-xs" style={{ color: C.text }}>{k}: {n}</div>)}
        {rows.map((r) => (
          <div key={r.id} className="flex items-center justify-between text-[11px]" style={{ color: C.muted }}>
            <span>{r.shot_type} · {r.camera_angle} · {new Date(r.created_at).toLocaleDateString()}</span>
            <button onClick={() => remove(r.id)} aria-label="Delete"><Trash2 size={14} /></button>
          </div>
        ))}
      </GlassCard>
    </div>
  );
}
