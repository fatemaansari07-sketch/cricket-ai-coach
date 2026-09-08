import React, { useState } from "react";
import { Crown, Check, Sparkles, Video, Zap } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { C, GlassCard, SolidButton, SectionTitle } from "../components/ui";

const TIERS = [
  { id:"free", name:"Free", price:"₹0", tagline:"Cricket AI Coach ka real basic analysis", points:[
    "Video upload karke batting/bowling analysis", "Moving skeleton + basic joint angles", "Ball tracking / movement replay", "Correct, wrong aur fix ka coaching feedback", "5 analyses/day", "Gemini credits nahi"
  ]},
  { id:"basic", name:"AI Coach", price:"₹99/mo", badge:"BEST VALUE", icon:Sparkles, featured:true, tagline:"Full AI Coach + limited Gemini credits", points:[
    "Free ka sab kuch", "Full skeleton + joint-by-joint angles", "Smart Stance → Impact → Follow-through phases", "Before vs After compare", "Progress + 30-day practice plan", "30 analyses/day", "Limited Gemini AI credits/month"
  ]},
  { id:"pro", name:"AI Coach Video", price:"₹499/mo", badge:"FLAGSHIP", icon:Video, tagline:"Professional shareable coaching video", points:[
    "₹99 plan ka sab kuch", "Ball trajectory + release + bounce + keeper tracking", "Bowler + batsman movement analysis", "Professional annotated coaching video", "Skeleton + angles + correct/wrong overlays", "Share-ready branded video", "10 coaching-video credits/month"
  ]},
];

export default function PricingScreen({ planTier, refreshProfile }) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(null);
  const selectTier = async (tierId) => {
    if (!user) return; setSaving(tierId);
    await supabase.from("profiles").update({ plan_tier:tierId, video_credits_remaining: tierId === "basic" ? 3 : tierId === "pro" ? 10 : 0, credits_reset_at: new Date().toISOString().slice(0,10) }).eq("id",user.id);
    await refreshProfile(); setSaving(null);
  };
  return <div className="space-y-4">
    <SectionTitle sub="Pehle cricket analysis try karo — phir AI Coach choose karo">Pricing</SectionTitle>
    {TIERS.map(t=>{const Icon=t.icon;return <GlassCard key={t.id} className="p-4" style={{border:`1px solid ${t.featured?C.gold:planTier===t.id?C.green:C.border}`}}>
      <div className="flex items-center justify-between mb-1"><div className="text-base font-extrabold flex items-center gap-1.5" style={{color:C.text}}>{t.name}{t.featured&&<Crown size={14} style={{color:C.gold}}/>}</div><div className="text-sm font-bold" style={{color:t.featured?C.gold:C.text}}>{t.price}</div></div>
      {t.badge&&<div className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full mb-2" style={{background:t.featured?"rgba(245,158,11,.12)":"rgba(16,185,129,.12)",color:t.featured?C.gold:C.green}}>{Icon&&<Icon size={10}/>} {t.badge}</div>}
      <div className="text-sm mb-3" style={{color:"#D1D5DB"}}>{t.tagline}</div>
      <div className="text-[10px] mb-2" style={{color:C.gold}}>Video credits: {t.id === "basic" ? "3/month" : t.id === "pro" ? "10/month" : "0/month"}</div>
            <ul className="space-y-1.5 mb-3.5">{t.points.map((p,i)=><li key={i} className="text-xs flex gap-1.5" style={{color:"#D1D5DB"}}><Check size={12} style={{color:C.green}} className="mt-0.5 shrink-0"/>{p}</li>)}</ul>
      <SolidButton tone={planTier===t.id?"green":t.featured?"gold":"dark"} onClick={()=>selectTier(t.id)} disabled={saving===t.id} className="py-2.5">{saving===t.id?"Saving...":planTier===t.id?"Active Plan":"Select Karo"}</SolidButton>
    </GlassCard>})}
    <div className="rounded-xl p-3 text-[10px] flex gap-2" style={{background:"rgba(245,158,11,.06)",border:`1px solid ${C.gold}33`,color:C.muted}}><Zap size={13} style={{color:C.gold}} className="shrink-0"/>Payment abhi demo DB switch hai. Production me Razorpay/UPI webhook se plan aur credits activate karna hoga.</div>
  </div>;
}
