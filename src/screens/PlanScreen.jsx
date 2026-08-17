import React, { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { generatePlanDays } from "../data/content";
import { C, GlassCard, AdSlot, Pill, SectionTitle } from "../components/ui";

export default function PlanScreen({ analysis, plan, setPlan, isPaid }) {
  const { user } = useAuth();
  const [openWeek, setOpenWeek] = useState(1);
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    async function save() {
      if (!analysis || !user || plan) return;
      setSaving(true);
      const days = generatePlanDays(analysis);
      try {
        const { data: planRow, error: planError } = await supabase
          .from("practice_plans")
          .insert({ user_id: user.id, category: analysis.category })
          .select()
          .single();
        if (!planError && planRow) {
          const rows = days.map((d) => ({
            plan_id: planRow.id,
            day_number: d.day,
            is_rest_day: !!d.rest,
            drill: d.drill || null,
            focus_point: d.focus || null,
          }));
          await supabase.from("practice_plan_days").insert(rows);
        }
      } catch {
        // non-fatal — plan still shows locally even if the save fails
      }
      setPlan(days);
      setSaving(false);
    }
    save();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysis]);

  if (!plan) {
    return (
      <div className="space-y-4">
        <SectionTitle sub="Pehle ek video analyze karo, phir plan yahan banega">30-Day Plan</SectionTitle>
        <GlassCard className="p-8 text-center text-sm" style={{ color: C.muted }}>
          {saving ? "Plan ban raha hai..." : 'Abhi koi plan nahi hai. "Analyze" tab me jaake apna video daalo.'}
        </GlassCard>
      </div>
    );
  }

  const weeks = [1, 2, 3, 4, 5];
  const weekDays = plan.filter((d) => Math.ceil(d.day / 7) === openWeek);

  return (
    <div className="space-y-4">
      <SectionTitle sub={analysis ? `${analysis.category[0].toUpperCase() + analysis.category.slice(1)} ke weak points par based` : ""}>30-Day Plan</SectionTitle>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {weeks.map((w) => (
          <Pill key={w} active={openWeek === w} onClick={() => setOpenWeek(w)}>Week {w}</Pill>
        ))}
      </div>

      <div className="space-y-2.5">
        {weekDays.map((d) => (
          <div
            key={d.day}
            className="rounded-2xl p-3.5 flex gap-3 backdrop-blur-md"
            style={{ background: d.rest ? "rgba(245,158,11,0.06)" : C.card, border: `1px solid ${d.rest ? "rgba(245,158,11,0.25)" : C.border}` }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-extrabold shrink-0"
              style={{ background: d.rest ? "rgba(245,158,11,0.15)" : "rgba(16,185,129,0.15)", color: d.rest ? C.gold : C.green }}
            >
              {d.day}
            </div>
            <div>
              {d.rest ? (
                <div className="text-sm" style={{ color: "#D1D5DB" }}>{d.focus}</div>
              ) : (
                <>
                  <div className="text-sm font-semibold" style={{ color: C.text }}>{d.drill}</div>
                  <div className="text-xs mt-0.5" style={{ color: C.muted }}>Focus: {d.focus}</div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {!isPaid && <AdSlot label="Sponsored — plan page" />}
    </div>
  );
}
