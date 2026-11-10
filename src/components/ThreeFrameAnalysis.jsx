import React from 'react';
import { Check, X } from 'lucide-react';
import { C, GlassCard } from './ui';

function Frame({ title, frame }) {
  if (!frame) return null;
  const points = frame.correct || frame.incorrect ? [...(frame.correct || []).map(x => ({ text: x, ok: true })), ...(frame.incorrect || []).map(x => ({ text: x, ok: false }))] : [];
  return <div className="min-w-[82%] rounded-2xl overflow-hidden" style={{ border: `1px solid ${C.border}`, background: C.card }}>
    {frame.image_url ? <img src={frame.image_url} alt={title} className="w-full aspect-video object-contain bg-black" /> : frame.dataUrl ? <img src={frame.dataUrl} alt={title} className="w-full aspect-video object-contain bg-black" /> : null}
    <div className="p-3"><div className="text-sm font-extrabold" style={{ color: C.text }}>{title}</div><div className="text-[10px] mt-1" style={{ color: C.muted }}>{frame.time_sec != null ? `${Number(frame.time_sec).toFixed(2)} sec` : ''}</div>
      <div className="mt-2 space-y-1">{points.map((p,i)=><div key={i} className="text-[11px] flex gap-1.5" style={{ color: p.ok ? C.green : C.red }}>{p.ok ? <Check size={13}/> : <X size={13}/>}<span style={{color:C.text}}>{p.text}</span></div>)}</div>
    </div>
  </div>;
}
export default function ThreeFrameAnalysis({ result }) {
  if (!result) return null;
  const f = result.frames || {};
  return <GlassCard className="p-3"><div className="text-sm font-extrabold mb-2" style={{color:C.text}}>🎯 3-Frame Visual Analysis</div><div className="flex gap-3 overflow-x-auto pb-1"><Frame title="Stance" frame={f.stance}/><Frame title="Impact" frame={f.impact}/><Frame title="Follow-Through" frame={f.follow_through || f.followThrough}/></div></GlassCard>;
}
