import React, { useState } from "react";
import { ShieldCheck, UserRound, Target, Crosshair } from "lucide-react";
import { C, GlassCard, Pill, SolidButton } from "./ui";
import { supabase } from "../lib/supabaseClient";

const ROLES = [
  { id: "batsman", label: "Batsman", icon: Target },
  { id: "bowler", label: "Bowler", icon: Crosshair },
  { id: "fielder", label: "Fielder", icon: ShieldCheck },
  { id: "all_rounder", label: "All-rounder", icon: UserRound },
];

export default function RoleSetup({ user, profile, onSaved }) {
  const [role, setRole] = useState(profile?.player_role || "batsman");
  const [hand, setHand] = useState(profile?.batting_hand || "right");
  const [bowling, setBowling] = useState(profile?.bowling_style || "fast");
  const [name, setName] = useState(profile?.full_name || user?.user_metadata?.full_name || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    setSaving(true); setError("");
    const { data, error } = await supabase.from("profiles").update({
      full_name: name.trim() || null,
      player_role: role,
      batting_hand: hand,
      bowling_style: bowling,
      onboarding_completed: true,
    }).eq("id", user.id).select().single();
    if (error) setError(error.message);
    else onSaved(data);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto" style={{ background: C.bg }}>
      <div className="max-w-md mx-auto px-5 py-8 min-h-full flex items-center">
        <div className="w-full space-y-4">
          <div className="text-center mb-5">
            <div className="text-2xl font-extrabold" style={{ color: C.text }}>Player profile set karo</div>
            <div className="text-xs mt-2" style={{ color: C.muted }}>Ye context har analysis me AI Coach ko diya jayega.</div>
          </div>
          <GlassCard className="p-4 space-y-4">
            <div>
              <div className="text-xs font-semibold mb-2" style={{ color: C.text }}>Naam</div>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Aapka naam" className="w-full rounded-xl px-3 py-3 outline-none text-sm" style={{ background: "rgba(255,255,255,.04)", border: `1px solid ${C.border}`, color: C.text }} />
            </div>
            <div>
              <div className="text-xs font-semibold mb-2" style={{ color: C.text }}>Primary role</div>
              <div className="grid grid-cols-2 gap-2">{ROLES.map(r => { const I=r.icon; return <button key={r.id} onClick={()=>setRole(r.id)} className="rounded-xl p-3 text-left" style={{ background: role===r.id ? "rgba(16,185,129,.14)" : "rgba(255,255,255,.03)", border: `1px solid ${role===r.id ? C.green : C.border}`, color:C.text }}><I size={16} style={{color:role===r.id?C.green:C.muted}}/><div className="text-xs font-bold mt-2">{r.label}</div></button> })}</div>
            </div>
            {(role === "batsman" || role === "all_rounder") && <div><div className="text-xs font-semibold mb-2" style={{color:C.text}}>Batting hand</div><div className="flex gap-2"><Pill active={hand==="right"} onClick={()=>setHand("right")}>Right hand</Pill><Pill active={hand==="left"} onClick={()=>setHand("left")}>Left hand</Pill></div></div>}
            {(role === "bowler" || role === "all_rounder") && <div><div className="text-xs font-semibold mb-2" style={{color:C.text}}>Bowling style</div><div className="flex flex-wrap gap-2"><Pill active={bowling==="fast"} onClick={()=>setBowling("fast")}>Fast</Pill><Pill active={bowling==="medium"} onClick={()=>setBowling("medium")}>Medium</Pill><Pill active={bowling==="spin"} onClick={()=>setBowling("spin")}>Spin</Pill></div></div>}
          </GlassCard>
          {error && <div className="text-xs" style={{color:C.red}}>{error}</div>}
          <SolidButton disabled={saving} onClick={save}>{saving ? "Save ho raha hai..." : "Profile Save Karo"}</SolidButton>
        </div>
      </div>
    </div>
  );
}
