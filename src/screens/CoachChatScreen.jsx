import React, { useState } from 'react';
import { Send, Sparkles, Lock } from 'lucide-react';
import { C, GlassCard, SolidButton, SectionTitle } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { askCoach } from '../lib/coachChat';
import { canUseCoachChat } from '../lib/planAccess';

export default function CoachChatScreen({ planTier }) {
  const { session } = useAuth();
  const allowed = canUseCoachChat(planTier);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  if (!allowed) return <GlassCard className="p-5"><Lock size={20} style={{color:C.gold}}/><div className="font-bold mt-2" style={{color:C.text}}>Coach Chat ₹999 me available hai.</div></GlassCard>;

  const send = async () => {
    const text = message.trim();
    if (!text || loading) return;
    const next = [...messages, { role:'user', content:text }];
    setMessages(next); setMessage(''); setLoading(true);
    try {
      const token = session?.access_token || (await import('../lib/supabaseClient').then(({supabase}) => supabase.auth.getSession())).data?.session?.access_token;
      const out = await askCoach({ message:text, history:next, planTier, token });
      setMessages([...next, { role:'assistant', content:out.reply || 'Coach reply nahi mila.' }]);
    } catch (e) {
      setMessages([...next, { role:'assistant', content:`Coach error: ${e.message}` }]);
    } finally { setLoading(false); }
  };

  return <div className="space-y-4 pb-4">
    <SectionTitle sub="Sirf cricket coaching, practice, technique aur progress.">AI Coach</SectionTitle>
    <GlassCard className="p-4"><div className="flex gap-2 items-center"><Sparkles size={18} style={{color:C.gold}}/><span className="text-sm font-bold" style={{color:C.text}}>Apne coach se poochho</span></div>
      <div className="text-xs mt-2" style={{color:C.muted}}>Example: “Meri biggest weakness kya hai?”, “Sirf head position check karo”, “Cover drive kaise improve karun?”</div></GlassCard>
    <div className="space-y-2">{messages.map((m,i)=><GlassCard key={i} className="p-3" style={{background:m.role==='user'?'rgba(16,185,129,.08)':C.card}}><div className="text-[10px] font-bold uppercase" style={{color:m.role==='user'?C.green:C.gold}}>{m.role==='user'?'You':'Coach'}</div><div className="text-sm mt-1 whitespace-pre-wrap" style={{color:C.text}}>{m.content}</div></GlassCard>)}</div>
    <div className="sticky bottom-0 flex gap-2" style={{background:C.app}}>
      <textarea value={message} onChange={e=>setMessage(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}}} rows={2} placeholder="Coach ko message karo..." className="flex-1 rounded-xl p-3 text-sm outline-none" style={{background:C.cardSolid,border:`1px solid ${C.border}`,color:C.text}} />
      <SolidButton onClick={send} disabled={loading||!message.trim()} className="!w-12 !px-0"><Send size={16}/></SolidButton>
    </div>
  </div>;
}
