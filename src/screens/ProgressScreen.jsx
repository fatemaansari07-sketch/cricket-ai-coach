import React, { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Lock, Flame } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { getJourneySummary } from "../lib/journey";
import { C, GlassCard, Pill, SectionTitle } from "../components/ui";

function JourneySummaryCard({ journey }) {
  if (!journey) return null;
  const { streak, sessionsCompleted, problemsFixed, activeFocuses } = journey;
  const isEmpty = !streak && sessionsCompleted === 0;

  return (
    <GlassCard className="p-4 space-y-3.5">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="flex items-center justify-center gap-1 text-lg font-extrabold" style={{ color: C.gold }}>
            <Flame size={15} />{streak}
          </div>
          <div className="text-[10px]" style={{ color: C.muted }}>Day Streak</div>
        </div>
        <div>
          <div className="text-lg font-extrabold" style={{ color: C.text }}>{sessionsCompleted}</div>
          <div className="text-[10px]" style={{ color: C.muted }}>Sessions</div>
        </div>
        <div>
          <div className="text-lg font-extrabold" style={{ color: C.green }}>{problemsFixed.length}</div>
          <div className="text-[10px]" style={{ color: C.muted }}>Problems Fixed</div>
        </div>
      </div>

      {isEmpty && (
        <div className="text-xs text-center py-1" style={{ color: C.muted }}>
          Pehla video analyze karo — journey yahan se shuru hogi.
        </div>
      )}

      {activeFocuses.length > 0 && (
        <div>
          <div className="text-xs font-bold mb-1.5" style={{ color: C.muted }}>Abhi kaam chal raha hai</div>
          <div className="flex flex-wrap gap-1.5">
            {activeFocuses.map((f) => (
              <span
                key={f.id}
                className="text-[11px] px-2.5 py-1 rounded-full"
                style={{ background: "rgba(245,158,11,0.12)", color: C.gold, border: `1px solid ${C.gold}33` }}
              >
                {f.issue_label}
              </span>
            ))}
          </div>
        </div>
      )}

      {problemsFixed.length > 0 && (
        <div>
          <div className="text-xs font-bold mb-1.5" style={{ color: C.muted }}>Fix ho gaya</div>
          <ul className="space-y-1.5">
            {problemsFixed.slice(0, 3).map((f) => (
              <li key={f.id} className="text-xs flex gap-2" style={{ color: "#D1D5DB" }}>
                <TrendingUp size={12} style={{ color: C.green }} className="mt-0.5 shrink-0" />
                <span><b style={{ color: C.text }}>{f.issue_label}</b> — {f.baseline_score} se {f.target_score}+ tak pahunche</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </GlassCard>
  );
}

function LineChart({ points, color }) {
  if (!points || points.length < 2) {
    return <div className="text-xs text-center py-8" style={{ color: C.muted }}>Kam se kam 2 analyses chahiye trend dikhane ke liye.</div>;
  }
  const W = 300, H = 120, pad = 10;
  const max = 100, min = 0;
  const stepX = (W - pad * 2) / (points.length - 1);
  const toY = (v) => H - pad - ((v - min) / (max - min)) * (H - pad * 2);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${pad + i * stepX} ${toY(p)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="120">
      <line x1={pad} y1={toY(70)} x2={W - pad} y2={toY(70)} stroke={C.border} strokeDasharray="3 3" strokeWidth="1" />
      <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <circle key={i} cx={pad + i * stepX} cy={toY(p)} r="3.5" fill={color} />
      ))}
    </svg>
  );
}

export default function ProgressScreen({ planTier }) {
  const { user } = useAuth();
  const [category, setCategory] = useState("batting");
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [journey, setJourney] = useState(null);

  const isPro = planTier === "pro";

  useEffect(() => {
    getJourneySummary(supabase, user.id).then(setJourney);
  }, [user.id]);

  useEffect(() => {
    if (!isPro) { setLoading(false); return; }
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from("analyses")
        .select("score, category, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });
      setAnalyses(data || []);
      setLoading(false);
    }
    load();
  }, [user.id, isPro]);

  if (!isPro) {
    return (
      <div className="space-y-4">
        <SectionTitle sub="Tumhara cricket journey — kya fix hua, kya chal raha hai">Progress</SectionTitle>
        <JourneySummaryCard journey={journey} />
        <GlassCard className="p-8 text-center">
          <div className="w-11 h-11 mx-auto mb-3 rounded-xl flex items-center justify-center" style={{ background: "rgba(245,158,11,0.15)" }}>
            <Lock style={{ color: C.gold }} size={20} />
          </div>
          <div className="text-sm font-semibold" style={{ color: C.text }}>Detailed weekly trend graph Pro plan me hai</div>
          <div className="text-xs mt-1.5" style={{ color: C.muted }}>₹299/mo me har category ka score-over-time graph unlock karo.</div>
        </GlassCard>
      </div>
    );
  }

  const filtered = analyses.filter((a) => a.category === category);
  const points = filtered.map((a) => a.score);
  const latest = points[points.length - 1];
  const first = points[0];
  const change = latest != null && first != null ? latest - first : null;

  return (
    <div className="space-y-4">
      <SectionTitle sub="Har analysis ka score, time ke saath">Progress</SectionTitle>

      <JourneySummaryCard journey={journey} />

      <div className="flex gap-2">
        {["batting", "bowling", "fielding"].map((c) => (
          <Pill key={c} active={category === c} onClick={() => setCategory(c)}>{c[0].toUpperCase() + c.slice(1)}</Pill>
        ))}
      </div>

      {loading ? (
        <div className="text-xs" style={{ color: C.muted }}>Loading...</div>
      ) : filtered.length === 0 ? (
        <GlassCard className="p-8 text-center text-sm" style={{ color: C.muted }}>
          Is category me abhi koi analysis nahi hai.
        </GlassCard>
      ) : (
        <>
          <GlassCard className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold" style={{ color: C.muted }}>{filtered.length} analyses</div>
              {change != null && (
                <div className="flex items-center gap-1 text-xs font-bold" style={{ color: change >= 0 ? C.green : C.red }}>
                  {change >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                  {change >= 0 ? "+" : ""}{change} se shuru se
                </div>
              )}
            </div>
            <LineChart points={points} color={C.green} />
          </GlassCard>

          <div className="grid grid-cols-3 gap-2.5">
            <GlassCard className="p-3 text-center">
              <div className="text-[10px]" style={{ color: C.muted }}>Pehla</div>
              <div className="text-lg font-extrabold" style={{ color: C.text }}>{first}</div>
            </GlassCard>
            <GlassCard className="p-3 text-center">
              <div className="text-[10px]" style={{ color: C.muted }}>Latest</div>
              <div className="text-lg font-extrabold" style={{ color: C.green }}>{latest}</div>
            </GlassCard>
            <GlassCard className="p-3 text-center">
              <div className="text-[10px]" style={{ color: C.muted }}>Best</div>
              <div className="text-lg font-extrabold" style={{ color: C.gold }}>{Math.max(...points)}</div>
            </GlassCard>
          </div>
        </>
      )}
    </div>
  );
}
