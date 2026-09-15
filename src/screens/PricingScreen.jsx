import React, { useState } from "react";
import { Crown, Check, Sparkles, Video, MessageCircle } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { C, GlassCard, SolidButton, SectionTitle } from "../components/ui";
import { PLAN_META } from "../data/plans";

const TIERS = [
  { id:"free", name:"Free", price:"₹0", tagline:"Powerful local cricket analysis — no Gemini cost", points:[
    "10-second proper video", "Shot select karke focused analysis", "MediaPipe skeleton + angles", "Kya sahi / kya galat + kaise fix kare", "Old vs New same-shot compare", "Result ke baad natural Pro upgrade", "No Gemini / no paid API"
  ]},
  { id:"pro_99", name:"Pro", price:"₹99", badge:"BEST VALUE", icon:Sparkles, featured:true, tagline:"3 keyframe visual coaching + 30-day progress", points:[
    "Free ka sab kuch", "Gemini selects Stance + Impact + Follow-through", "Exactly 3 images — skeleton + angles + right/wrong", "100 visual credits/month", "1 visual analysis = 10 credits", "30-day practice program + 7-day tests", "Advanced self-vs-player compare"
  ]},
  { id:"video_499", name:"Video Visualization", price:"₹499", badge:"FLAGSHIP", icon:Video, tagline:"Broadcast-style coaching visualization", points:[
    "Pro ka sab kuch", "100 visual credits/month", "100 video credits/month", "10s coaching video = 10 video credits", "Smooth ball path + release + bounce/tappa", "Moving skeleton + angles + right/wrong", "Download/share with Cricket AI Coach watermark"
  ]},
  { id:"special_999", name:"Special Coaching", price:"₹999", badge:"PERSONAL COACH", icon:MessageCircle, tagline:"AI coach jo tumhari journey yaad rakhe", points:[
    "Video Visualization ka sab kuch", "Full training roadmap", "Skill-by-skill progression", "Coach Chat — cricket only", "Video bhejkar natural coaching questions", "Weakness memory + progress history", "100 visual + 100 video credits/month"
  ]},
];

export default function PricingScreen({ planTier, refreshProfile }) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(null);
  const selectTier = async (tierId) => {
    if (!user) return; setSaving(tierId);
    const meta = PLAN_META[tierId];
    await supabase.from("profiles").update({
      plan_tier: tierId,
      visual_credits_remaining: meta.visualCredits,
      video_credits_remaining: meta.videoCredits,
      credits_reset_at: new Date().toISOString().slice(0,10),
    }).eq("id",user.id);
    await refreshProfile(); setSaving(null);
  };
  return <div className="space-y-4">
    <SectionTitle sub="Free se start karo. Jis level ki coaching chahiye, wahi unlock karo.">Plans</SectionTitle>
    {TIERS.map(t=>{const Icon=t.icon;return <GlassCard key={t.id} className="p-4" style={{border:`1px solid ${t.featured?C.gold:planTier===t.id?C.green:C.border}`}}>
      <div className="flex items-center justify-between mb-1"><div className="text-base font-extrabold flex items-center gap-1.5" style={{color:C.text}}>{t.name}{t.featured&&<Crown size={14} style={{color:C.gold}}/>}</div><div className="text-sm font-bold" style={{color:t.featured?C.gold:C.text}}>{t.price}{t.id!=="free"&&<span className="text-[9px]" style={{color:C.muted}}>/mo</span>}</div></div>
      {t.badge&&<div className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full mb-2" style={{background:t.featured?"rgba(245,158,11,.12)":"rgba(16,185,129,.12)",color:t.featured?C.gold:C.green}}>{Icon&&<Icon size={10}/>} {t.badge}</div>}
      <div className="text-sm mb-3" style={{color:"#D1D5DB"}}>{t.tagline}</div>
      <ul className="space-y-1.5 mb-3.5">{t.points.map((p,i)=><li key={i} className="text-xs flex gap-1.5" style={{color:"#D1D5DB"}}><Check size={12} style={{color:C.green}} className="mt-0.5 shrink-0"/>{p}</li>)}</ul>
      <SolidButton tone={planTier===t.id?"green":t.featured?"gold":"dark"} onClick={()=>selectTier(t.id)} disabled={saving===t.id} className="py-2.5">{saving===t.id?"Saving...":planTier===t.id?"Active Plan":"Select Karo"}</SolidButton>
    </GlassCard>})}
    <div className="rounded-xl p-3 text-[10px]" style={{background:"rgba(245,158,11,.06)",border:`1px solid ${C.gold}33`,color:C.muted}}>Payment switch abhi demo hai. Production me Razorpay/UPI webhook se plan + credits activate karna hoga. Recharge buttons bhi backend payment ke baad hi credits dene chahiye.</div>
  </div>;
}
