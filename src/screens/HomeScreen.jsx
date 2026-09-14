import React from "react";
import { Video, Gauge, Trophy, Sparkles, MessageCircle } from "lucide-react";
import { C, GlassCard, SolidButton, SectionTitle } from "../components/ui";

export default function HomeScreen({ isPaid, planTier, setTab }) {
  const name = planTier === "free" ? "Free" : planTier === "pro_99" ? "Pro ₹99" : planTier === "video_499" ? "Video ₹499" : "Coach ₹999";
  return <div className="space-y-4">
    <SectionTitle sub="Har shot ko better banao — step by step">Cricket AI Coach</SectionTitle>
    <GlassCard className="p-4" style={{border:`1px solid ${C.green}44`}}>
      <div className="text-xs" style={{color:C.muted}}>Current plan</div><div className="text-xl font-extrabold mt-1" style={{color:C.text}}>{name}</div>
      <div className="text-xs mt-2" style={{color:C.muted}}>Free = local MediaPipe. Pro = 3 visual keyframes. Video = broadcast visualization. Special = personal AI coach.</div>
    </GlassCard>
    <div className="grid grid-cols-2 gap-3">
      <Action icon={Video} title="Analyze Shot" text="10 sec video" onClick={()=>setTab("analyze")} />
      <Action icon={Gauge} title="Speed Gun" text="Live estimate" onClick={()=>setTab("speed")} />
      <Action icon={Trophy} title="Progress" text="Practice journey" onClick={()=>setTab("progress")} />
      <Action icon={Sparkles} title="Compare" text="Old vs new / player" onClick={()=>setTab("compare")} />
    </div>
    {planTier === "special_999" && <GlassCard className="p-4"><div className="flex items-center gap-2 font-bold" style={{color:C.text}}><MessageCircle size={16} style={{color:C.gold}}/> Personal Coach</div><div className="text-xs mt-1" style={{color:C.muted}}>Video upload karke coach se cricket-only sawal pucho.</div><SolidButton tone="gold" className="mt-3" onClick={()=>setTab("coach")}>Coach Chat kholo</SolidButton></GlassCard>}
    <GlassCard className="p-4"><div className="text-sm font-bold" style={{color:C.text}}>Recording tip</div><div className="text-xs mt-1 leading-relaxed" style={{color:C.muted}}>Side-on/square-leg angle, poora body frame me, stable phone, achhi light, 10 sec clip, ek hi shot/delivery. Jitna clean input, utna accurate result.</div></GlassCard>
  </div>;
}
function Action({icon:Icon,title,text,onClick}){return <button onClick={onClick} className="text-left rounded-2xl p-4 active:scale-95" style={{background:C.cardSolid,border:`1px solid ${C.border}`}}><Icon size={19} style={{color:C.green}}/><div className="text-sm font-extrabold mt-3" style={{color:C.text}}>{title}</div><div className="text-[10px] mt-1" style={{color:C.muted}}>{text}</div></button>}
