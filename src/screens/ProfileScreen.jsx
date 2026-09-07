import React, { useState } from "react";
import { User, Save, Crown, TrendingUp } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabaseClient";
import { C, GlassCard, SolidButton, SectionTitle, PlanBadge, MetricBox } from "../components/ui";

const ROLES = ["batsman", "bowler", "all_rounder", "wicket_keeper"];
const BATTING_STYLES = ["right_hand", "left_hand"];
const BOWLING_STYLES = [
  "right_arm_fast", "right_arm_medium", "right_arm_spin",
  "left_arm_fast", "left_arm_medium", "left_arm_spin", "none",
];
const LEVELS = ["beginner", "intermediate", "advanced", "professional"];

function labelize(v) {
  return v.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function Field({ label, children }) {
  return (
    <div className="text-left mb-4">
      <label className="block text-xs font-semibold mb-1.5" style={{ color: C.text }}>{label}</label>
      {children}
    </div>
  );
}

function inputStyle() {
  return {
    background: "rgba(255,255,255,0.06)",
    border: `1px solid ${C.border}`,
    color: C.text,
  };
}

export default function ProfileScreen({ setTab }) {
  const { user, profile, refreshProfile } = useAuth();

  const [form, setForm] = useState({
    full_name: profile?.full_name || "",
    age: profile?.age || "",
    playing_role: profile?.playing_role || "",
    batting_style: profile?.batting_style || "",
    bowling_style: profile?.bowling_style || "",
    experience_level: profile?.experience_level || "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(profile?.avatar_url || null);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handlePhotoPick = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setPhotoFile(f);
    setPhotoPreview(URL.createObjectURL(f));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);

    try {
      let avatar_url = profile?.avatar_url || null;

      if (photoFile) {
        const path = `${user.id}/${Date.now()}-${photoFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(path, photoFile, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
        avatar_url = pub.publicUrl;
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          full_name: form.full_name,
          age: form.age ? Number(form.age) : null,
          playing_role: form.playing_role || null,
          batting_style: form.batting_style || null,
          bowling_style: form.bowling_style || null,
          experience_level: form.experience_level || null,
          avatar_url,
        })
        .eq("id", user.id);

      if (updateError) throw updateError;

      await refreshProfile?.();
      setSaved(true);
    } catch (err) {
      setError(err.message || "Profile save nahi hua, dubara try karo.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-1 pb-6">
      <SectionTitle sub="Batting/bowling style, experience — AI isse aapko samajhta hai">
        Player Profile
      </SectionTitle>

      <GlassCard className="p-5 mt-3 flex items-center justify-between">
        <div>
          <div className="text-[11px] font-semibold" style={{ color: C.muted }}>CURRENT PLAN</div>
          <div className="mt-1"><PlanBadge planTier={profile?.plan_tier || "free"} /></div>
        </div>
        <div className="flex items-center gap-3">
          <MetricBox label="Analyzed today" value={profile?.videos_analyzed_today ?? 0} />
          <button onClick={() => setTab?.("progress")} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl" style={{ background: "rgba(16,185,129,0.12)", color: C.green }}>
            <TrendingUp size={14} /> Progress
          </button>
          {profile?.plan_tier !== "pro" && (
            <button onClick={() => setTab?.("pricing")} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl" style={{ background: "rgba(245,158,11,0.12)", color: C.gold }}>
              <Crown size={14} /> Upgrade
            </button>
          )}
        </div>
      </GlassCard>

      <GlassCard className="p-5 mt-3">
        <div className="flex flex-col items-center mb-5">
          <label className="cursor-pointer">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center overflow-hidden mb-2 mx-auto"
              style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}` }}
            >
              {photoPreview ? (
                <img src={photoPreview} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <User size={22} style={{ color: C.muted }} />
              )}
            </div>
            <input type="file" accept="image/*" className="hidden" onChange={handlePhotoPick} />
            <div className="text-xs text-center font-medium" style={{ color: C.green }}>Photo badlo</div>
          </label>
        </div>

        <form onSubmit={handleSubmit}>
          <Field label="Naam">
            <input
              name="full_name" value={form.full_name} onChange={handleChange} required
              className="w-full rounded-xl px-4 py-3 text-sm outline-none" style={inputStyle()}
            />
          </Field>

          <Field label="Age">
            <input
              type="number" name="age" value={form.age} onChange={handleChange}
              className="w-full rounded-xl px-4 py-3 text-sm outline-none" style={inputStyle()}
            />
          </Field>

          <Field label="Playing Role">
            <select name="playing_role" value={form.playing_role} onChange={handleChange}
              className="w-full rounded-xl px-4 py-3 text-sm outline-none" style={inputStyle()}>
              <option value="">Select...</option>
              {ROLES.map((r) => <option key={r} value={r}>{labelize(r)}</option>)}
            </select>
          </Field>

          <Field label="Batting Style">
            <select name="batting_style" value={form.batting_style} onChange={handleChange}
              className="w-full rounded-xl px-4 py-3 text-sm outline-none" style={inputStyle()}>
              <option value="">Select...</option>
              {BATTING_STYLES.map((r) => <option key={r} value={r}>{labelize(r)}</option>)}
            </select>
          </Field>

          <Field label="Bowling Style">
            <select name="bowling_style" value={form.bowling_style} onChange={handleChange}
              className="w-full rounded-xl px-4 py-3 text-sm outline-none" style={inputStyle()}>
              <option value="">Select...</option>
              {BOWLING_STYLES.map((r) => <option key={r} value={r}>{labelize(r)}</option>)}
            </select>
          </Field>

          <Field label="Experience Level">
            <select name="experience_level" value={form.experience_level} onChange={handleChange}
              className="w-full rounded-xl px-4 py-3 text-sm outline-none" style={inputStyle()}>
              <option value="">Select...</option>
              {LEVELS.map((r) => <option key={r} value={r}>{labelize(r)}</option>)}
            </select>
          </Field>

          {error && <div className="text-xs mb-3" style={{ color: C.red }}>{error}</div>}
          {saved && <div className="text-xs mb-3" style={{ color: C.green }}>Profile save ho gaya.</div>}

          <SolidButton type="submit" tone="green" disabled={saving}>
            <span className="flex items-center justify-center gap-2">
              <Save size={16} /> {saving ? "Saving..." : "Save Profile"}
            </span>
          </SolidButton>
        </form>
      </GlassCard>
    </div>
  );
}
