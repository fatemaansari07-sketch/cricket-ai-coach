import React, { useState } from "react";
import { Crown, Check, Sparkles, Coffee } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { C, GlassCard, SolidButton, SectionTitle } from "../components/ui";

const TIERS = [
  {
    id: "free",
    name: "Free",
    price: "₹0",
    tagline: "Coaching loop try karo",
    points: [
      "Main focus + drills + target — pura coaching loop",
      "2 shot types har category me",
      "5 analyses/din",
    ],
  },
  {
    id: "basic",
    name: "Basic",
    price: "₹99/mo",
    badge: "Ek chai ke price me",
    icon: Coffee,
    tagline: "Ads hatao, sab shots kholo",
    points: [
      "Sab shot types unlock",
      "Ads-free analysis screens",
      "30 analyses/din",
      "Apna purana vs naya video compare",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "₹299/mo",
    badge: "Real AI Coach",
    icon: Sparkles,
    tagline: "Gemini AI Deep Scan — kisi bhi camera angle se sabse accurate result",
    points: [
      "100 analyses/din",
      "Kisi bhi reference video se side-by-side compare",
      "Full weekly progress graph",
    ],
    featured: true,
  },
];

export default function PricingScreen({ planTier, refreshProfile }) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(null);

  const selectTier = async (tierId) => {
    if (!user) return;
    setSaving(tierId);
    // NOTE: this just flips the plan flag directly for demo purposes.
    // Wire this button to your Razorpay/UPI checkout flow, and only call
    // this update from your payment-webhook handler once payment succeeds.
    await supabase.from("profiles").update({ plan_tier: tierId }).eq("id", user.id);
    await refreshProfile();
    setSaving(null);
  };

  return (
    <div className="space-y-4">
      <SectionTitle sub="Ek baar try karo, phir jo pasand aaye wahi rakho">Pricing</SectionTitle>

      {TIERS.map((t) => {
        const Icon = t.icon;
        return (
          <GlassCard
            key={t.id}
            className="p-4"
            style={{ border: `1px solid ${t.featured ? C.gold : planTier === t.id ? C.green : C.border}` }}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="text-base font-extrabold flex items-center gap-1.5" style={{ color: C.text }}>
                {t.name}
                {t.featured && <Crown size={14} style={{ color: C.gold }} />}
              </div>
              <div className="text-sm font-bold" style={{ color: t.featured ? C.gold : C.text }}>{t.price}</div>
            </div>

            {t.badge && (
              <div className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full mb-2" style={{ background: t.featured ? "rgba(245,158,11,0.12)" : "rgba(16,185,129,0.12)", color: t.featured ? C.gold : C.green }}>
                {Icon && <Icon size={10} />} {t.badge}
              </div>
            )}

            <div className="text-sm mb-3" style={{ color: "#D1D5DB" }}>{t.tagline}</div>

            <ul className="space-y-1.5 mb-3.5">
              {t.points.map((p, i) => (
                <li key={i} className="text-xs flex gap-1.5" style={{ color: "#D1D5DB" }}>
                  <Check size={12} style={{ color: C.green }} className="mt-0.5 shrink-0" />{p}
                </li>
              ))}
            </ul>

            <SolidButton
              tone={planTier === t.id ? "green" : t.featured ? "gold" : "dark"}
              onClick={() => selectTier(t.id)}
              disabled={saving === t.id}
              className="py-2.5"
            >
              {saving === t.id ? "Saving..." : planTier === t.id ? "Active Plan" : t.id === "free" ? "Free me Shuru Karo" : "Select Karo"}
            </SolidButton>
          </GlassCard>
        );
      })}

      <p className="text-[10px] text-center" style={{ color: C.muted }}>
        Abhi plan_tier seedha DB me update hota hai (demo). Real payment ke liye Razorpay/UPI checkout jodo aur webhook se plan_tier update karo.
      </p>
    </div>
  );
}
