import React from "react";
import { Check, Crown, Building2, Clock3 } from "lucide-react";
import { C, GlassCard } from "../components/ui";

const PLANS = [
  { id:"free", name:"Free", price:"₹0", sub:"Local MediaPipe", bullets:["5 local analyses/day","7 batting shots","30-day recommendation","Basic Compare","Daily Challenge"] },
  { id:"pro_99", name:"Pro", price:"₹99", sub:"100 visual credits / month", bullets:["Everything in Free","3 key frames: stance/impact/follow-through","Skeleton + angles + AI corrections","100 visual credits","30-day program + weekly tests","Advanced Compare"] },
  { id:"video_499", name:"Video Visualization", price:"₹499", sub:"Advanced video coaching", featured:true, bullets:["Everything in Pro","Annotated coaching replay","Trajectory + bounce + skeleton overlay","Video analysis tools","Video Compare","100 video credits / month"] },
  { id:"special_coach", name:"Special Coaching", price:"₹999", sub:"Personal AI Coach", bullets:["Everything in Video","Adaptive coaching roadmap","Coach Chat using history","Skill-stage progression","Personalized practice guidance"] },
];

export default function PricingScreen({ planTier }) {
  return <div className="space-y-4">
    <div>
      <h2 className="text-2xl font-extrabold" style={{color:C.text}}>Plans</h2>
      <p className="text-xs mt-1" style={{color:C.muted}}>Apni practice aur coaching needs ke hisaab se plan chuno.</p>
    </div>
    {PLANS.map(p=><GlassCard key={p.id} className="p-4" style={{borderColor:p.featured?C.gold:planTier===p.id?`${C.green}77`:C.border, borderWidth:p.featured?2:1}}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-base font-extrabold" style={{color:C.text}}>{p.name}</div>
            {p.featured&&<span className="text-[9px] font-bold px-2 py-1 rounded-full" style={{background:C.gold,color:'#17120A'}}>ADVANCED</span>}
            {planTier===p.id&&<span className="text-[9px] font-bold px-2 py-1 rounded-full" style={{background:C.green,color:'#06110B'}}>CURRENT</span>}
          </div>
          <div className="text-xs mt-1" style={{color:C.muted}}>{p.sub}</div>
        </div>
        <div className="text-xl font-black whitespace-nowrap" style={{color:p.featured?C.gold:C.text}}>{p.price}<span className="text-[10px] font-medium" style={{color:C.muted}}>/mo</span></div>
      </div>
      <div className="space-y-2 mt-4">{p.bullets.map(b=><div key={b} className="flex gap-2 text-xs" style={{color:C.text}}><Check size={14} style={{color:C.green}} className="shrink-0"/>{b}</div>)}</div>
      {p.id!=="free"&&<div className="mt-4 rounded-xl p-3 text-xs flex items-start gap-2" style={{background:"rgba(255,255,255,0.035)",border:`1px solid ${C.border}`,color:C.muted}}><Clock3 size={15} className="shrink-0 mt-0.5"/><span>Paid subscription checkout abhi connect nahi hai. Payment setup hone tak plan ko yahan se free mein activate nahi kiya ja sakta.</span></div>}
    </GlassCard>)}
    <GlassCard className="p-4" style={{borderColor:C.gold,borderWidth:1}}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{background:"rgba(245,158,11,.12)",color:C.gold}}><Building2 size={21}/></div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap"><h3 className="text-base font-extrabold" style={{color:C.text}}>Special for Clubs</h3><span className="text-[9px] font-bold px-2 py-1 rounded-full" style={{background:"rgba(245,158,11,.15)",color:C.gold}}>COMING SOON</span></div>
          <p className="text-xs mt-1" style={{color:C.muted}}>Sirf cricket academies aur clubs ke liye — individual players ke liye nahi.</p>
          <div className="text-2xl font-black mt-2" style={{color:C.gold}}>₹1,00,000 <span className="text-xs font-semibold" style={{color:C.muted}}>/ month</span></div>
          <p className="text-xs mt-2" style={{color:C.text}}>Planned: multi-player management, academy-wide progress reports, coach assignments aur club-level analytics.</p>
          <div className="text-[10px] mt-2" style={{color:C.muted}}>Features aur availability launch se pehle confirm kiye jayenge. Abhi purchase ya activation available nahi hai.</div>
        </div>
      </div>
    </GlassCard>
  </div>;
}
