import React, { useState } from "react";
import { Crown, Check } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { C, GlassCard, SolidButton, SectionTitle } from "../components/ui";

const TIERS = [
  {
    id: "free",
    name: "Free",
    price: "₹0",
    points: [
      "Video analyze — batting/bowling/fielding",
      "2 shot types har category me (jaise sirf Cover Drive + Straight Drive)",
      "30-day practice plan",
      "10 analyses/din",
      "Ads dikhenge har feature me",
    ],
  },
  {
    id: "basic",
    name: "Basic",
    price: "₹99/mo",
    alt: "ya ₹10 / video compare",
    points: [
      "Free ka sab kuch, plus:",
      "Sab shot types unlock (Pull, Cut, Sweep, sab kuch)",
      "Apna purana vs naya video compare",
      "30 analyses/din",
      "Ads-free analysis screens",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "₹299/mo",
    alt: "ya ₹10 / video compare",
    points: [
      "Basic ka sab kuch, plus:",
      "Kisi bhi reference video se compare — side-by-side, joint-by-joint",
      "Gemini AI deep analysis (kisi bhi camera angle se)",
      "Weekly check-in — har hafte progress trend dekho",
      "100 analyses/din",
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
      <SectionTitle sub="Apna plan choose karo">Pricing</SectionTitle>
      {TIERS.map((t) => (
        <GlassCard key={t.id} className="p-4" style={{ border: `1px solid ${t.featured ? C.gold : planTier === t.id ? C.green : C.border}` }}>
          <div className="flex items-center justify-between mb-2.5">
            <div className="text-base font-extrabold flex items-center gap-1.5" style={{ color: C.text }}>
              {t.name}
              {t.featured && <Crown size={14} style={{ color: C.gold }} />}
            </div>
            <div className="text-right">
              <div className="text-sm font-bold" style={{ color: t.featured ? C.gold : C.green }}>{t.price}</div>
              {t.alt && <div className="text-[10px]" style={{ color: C.muted }}>{t.alt}</div>}
            </div>
          </div>
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
            {saving === t.id ? "Saving..." : planTier === t.id ? "Active Plan" : "Select Karo"}
          </SolidButton>
        </GlassCard>
      ))}
      <p className="text-[10px] text-center" style={{ color: C.muted }}>
        Abhi plan_tier seedha DB me update hota hai (demo). Real payment ke liye Razorpay/UPI checkout jodo aur webhook se plan_tier update karo.
      </p>
    </div>
  );
}
