import React, { useEffect, useState } from "react";
import { School, Copy, Check, TrendingUp, TrendingDown, Target, Flame } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { C, GlassCard, SolidButton, SectionTitle } from "../components/ui";

function genCode(name) {
  const clean = (name || "ACAD").replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 6);
  return `${clean || "ACAD"}${Math.floor(1000 + Math.random() * 9000)}`;
}

export default function AcademyScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const [academy, setAcademy] = useState(null);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [students, setStudents] = useState([]);
  const [reports, setReports] = useState({}); // student_id -> { batting, bowling, fielding } summaries
  const [focuses, setFocuses] = useState({}); // student_id -> array of active player_focus rows
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: acad } = await supabase
        .from("academies")
        .select("*")
        .eq("owner_user_id", user.id)
        .maybeSingle();
      setAcademy(acad || null);

      if (acad) {
        const { data: studentRows } = await supabase
          .from("profiles")
          .select("id, full_name, phone, created_at, practice_streak, last_practice_date")
          .eq("academy_id", acad.id)
          .order("created_at", { ascending: false });
        setStudents(studentRows || []);

        if (studentRows && studentRows.length > 0) {
          const ids = studentRows.map((s) => s.id);
          const { data: analysisRows } = await supabase
            .from("analyses")
            .select("user_id, category, score, created_at")
            .in("user_id", ids)
            .order("created_at", { ascending: false });

          const grouped = {};
          (analysisRows || []).forEach((a) => {
            if (!grouped[a.user_id]) grouped[a.user_id] = { batting: [], bowling: [], fielding: [] };
            grouped[a.user_id][a.category]?.push(a.score);
          });
          setReports(grouped);

          const { data: focusRows } = await supabase
            .from("player_focus")
            .select("user_id, category, issue_label")
            .in("user_id", ids)
            .eq("status", "active");

          const groupedFocuses = {};
          (focusRows || []).forEach((f) => {
            if (!groupedFocuses[f.user_id]) groupedFocuses[f.user_id] = [];
            groupedFocuses[f.user_id].push(f);
          });
          setFocuses(groupedFocuses);
        }
      }
      setLoading(false);
    }
    load();
  }, [user.id]);

  const createAcademy = async () => {
    if (!name.trim()) return;
    setCreating(true);
    const invite_code = genCode(name);
    const { data, error } = await supabase
      .from("academies")
      .insert({ name: name.trim(), invite_code, owner_user_id: user.id })
      .select()
      .single();
    if (!error) {
      setAcademy(data);
      await supabase.from("profiles").update({ is_academy_owner: true }).eq("id", user.id);
      await refreshProfile();
    }
    setCreating(false);
  };

  const copyCode = () => {
    navigator.clipboard.writeText(academy.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const avg = (arr) => (arr && arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null);

  if (loading) {
    return <div className="text-xs" style={{ color: C.muted }}>Loading...</div>;
  }

  if (!academy) {
    return (
      <div className="space-y-4">
        <SectionTitle sub="Apni academy banao — students ka poora data free me dekho">Academy</SectionTitle>
        <GlassCard className="p-6">
          <School className="mb-3" size={22} style={{ color: C.green }} />
          <div className="text-sm font-semibold mb-1" style={{ color: C.text }}>Academy ka naam do</div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jaise: Rising Stars Cricket Academy"
            className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none mt-2 mb-3"
            style={{ background: "rgba(0,0,0,0.3)", border: `1px solid ${C.border}`, color: C.text }}
          />
          <SolidButton tone="green" disabled={!name.trim() || creating} onClick={createAcademy}>
            {creating ? "Ban raha hai..." : "Academy Banao"}
          </SolidButton>
          <p className="text-[10px] mt-3" style={{ color: C.muted }}>
            Ek invite code milega — apne students ko do, wo signup ke time daalenge, aur unka data yahan free me dikhega.
          </p>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SectionTitle sub={academy.name}>Academy Dashboard</SectionTitle>

      <GlassCard className="p-4 flex items-center justify-between" style={{ border: `1px solid ${C.gold}` }}>
        <div>
          <div className="text-[10px] uppercase tracking-widest" style={{ color: C.muted }}>Invite Code</div>
          <div className="text-lg font-extrabold tracking-widest" style={{ color: C.gold, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{academy.invite_code}</div>
        </div>
        <button onClick={copyCode} className="p-2.5 rounded-xl active:scale-90 transition-transform" style={{ background: C.gold, color: "#0B0F17" }}>
          {copied ? <Check size={16} /> : <Copy size={16} />}
        </button>
      </GlassCard>

      <div className="text-xs" style={{ color: C.muted }}>{students.length} student{students.length !== 1 ? "s" : ""} linked</div>

      {students.length === 0 && (
        <GlassCard className="p-6 text-center text-sm" style={{ color: C.muted }}>
          Abhi koi student nahi joda. Invite code share karo — signup ke time wo isse daalenge.
        </GlassCard>
      )}

      <div className="space-y-2.5">
        {students.map((s) => {
          const r = reports[s.id] || { batting: [], bowling: [], fielding: [] };
          const studentFocuses = focuses[s.id] || [];
          return (
            <GlassCard key={s.id} className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-bold" style={{ color: C.text }}>{s.full_name || s.phone || "Student"}</div>
                {s.practice_streak > 0 && (
                  <div className="flex items-center gap-1 text-xs font-semibold" style={{ color: C.gold }}>
                    <Flame size={12} /> {s.practice_streak}
                  </div>
                )}
              </div>

              {studentFocuses.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2.5">
                  {studentFocuses.map((f, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full"
                      style={{ background: "rgba(245,158,11,0.12)", color: C.gold, border: `1px solid ${C.gold}33` }}
                    >
                      <Target size={9} /> {f.category[0].toUpperCase() + f.category.slice(1)}: {f.issue_label}
                    </span>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                {["batting", "bowling", "fielding"].map((cat) => {
                  const a = avg(r[cat]);
                  return (
                    <div key={cat} className="rounded-xl p-2.5 text-center" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border}` }}>
                      <div className="text-[9px] uppercase tracking-wide mb-1" style={{ color: C.muted }}>{cat}</div>
                      {a == null ? (
                        <div className="text-xs" style={{ color: C.muted }}>—</div>
                      ) : (
                        <div className="flex items-center justify-center gap-1 text-sm font-bold" style={{ color: a >= 70 ? C.green : C.red }}>
                          {a >= 70 ? <TrendingUp size={12} /> : <TrendingDown size={12} />} {a}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}
