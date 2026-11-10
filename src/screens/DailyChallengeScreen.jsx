import React, { useEffect, useState } from "react";
import { CheckCircle2, Flame, Gift, Trophy } from "lucide-react";
import { C, GlassCard, SolidButton } from "../components/ui";

const QUESTIONS = [
  { q: "Cover drive me head ideally kahan stable rehna chahiye?", options: ["Ball ki line ke paas stable", "Peeche shoulder par", "Sirf back foot ke upar", "Kahin bhi"], answer: 0 },
  { q: "Sachin Tendulkar ne Test debut kis country ke khilaf kiya?", options: ["Australia", "Pakistan", "England", "Sri Lanka"], answer: 1 },
  { q: "Yorker ka target aam taur par kahan hota hai?", options: ["Batsman ke helmet par", "Stumps/feet ke paas", "Fine leg ke bahar", "Mid-off ke paas"], answer: 1 },
  { q: "Follow-through ka ek important purpose kya hai?", options: ["Balance maintain karna", "Eyes band karna", "Run rokna", "Bat chhodna"], answer: 0 },
];

export default function DailyChallengeScreen() {
  const today = new Date().toISOString().slice(0, 10);
  const [question, setQuestion] = useState(QUESTIONS[new Date().getDate() % QUESTIONS.length]);
  const [selected, setSelected] = useState(null);
  const [correct, setCorrect] = useState(false);
  const [streak, setStreak] = useState(() => Number(localStorage.getItem("cic_challenge_streak") || 0));
  const [solvedToday, setSolvedToday] = useState(() => localStorage.getItem("cic_challenge_day") === today);
  const [correctCount, setCorrectCount] = useState(() => Number(localStorage.getItem("cic_correct_count") || 0));

  useEffect(() => { setQuestion(QUESTIONS[new Date().getDate() % QUESTIONS.length]); }, []);

  const answer = (i) => {
    if (solvedToday) return;
    setSelected(i);
    const ok = i === question.answer;
    setCorrect(ok);
    const next = ok ? correctCount + 1 : correctCount;
    if (ok) {
      setCorrectCount(next); localStorage.setItem("cic_correct_count", String(next));
      const nextStreak = streak + 1; setStreak(nextStreak); localStorage.setItem("cic_challenge_streak", String(nextStreak));
    } else {
      setStreak(0); localStorage.setItem("cic_challenge_streak", "0");
    }
    setSolvedToday(true); localStorage.setItem("cic_challenge_day", today);
  };

  const rewardReady = correctCount >= 10;

  return <div className="space-y-4">
    <div className="flex items-center justify-between"><div><h2 className="text-2xl font-extrabold" style={{color:C.text}}>Daily Challenge</h2><p className="text-xs mt-1" style={{color:C.muted}}>Roz ek cricket question. 10 correct = reward.</p></div><div className="flex items-center gap-1 text-xs font-bold" style={{color:C.gold}}><Flame size={15}/>{streak}</div></div>
    <GlassCard className="p-4">
      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest" style={{color:C.muted}}><span>Today</span><span>{correctCount}/10 correct</span></div>
      <div className="text-base font-bold leading-relaxed mt-4" style={{color:C.text}}>{question.q}</div>
      <div className="space-y-2 mt-4">{question.options.map((o,i)=><button key={o} onClick={()=>answer(i)} disabled={solvedToday} className="w-full text-left rounded-xl px-3 py-3 text-sm" style={{background:selected===i?(correct?"rgba(16,185,129,.16)":"rgba(239,68,68,.12)"):"rgba(255,255,255,.03)",border:`1px solid ${selected===i?(correct?C.green:C.red):C.border}`,color:C.text}}>{String.fromCharCode(65+i)}. {o}</button>)}</div>
      {solvedToday && <div className="mt-4 text-xs" style={{color:correct?C.green:C.red}}>{correct ? "Sahi jawab! Kal phir aana." : "Aaj ka answer submit ho gaya. Kal naya challenge."}</div>}
    </GlassCard>
    <div className="grid grid-cols-2 gap-3">
      <GlassCard className="p-4"><Trophy size={18} style={{color:C.gold}}/><div className="text-lg font-extrabold mt-2" style={{color:C.text}}>{correctCount}</div><div className="text-[10px]" style={{color:C.muted}}>Correct answers</div></GlassCard>
      <GlassCard className="p-4"><Gift size={18} style={{color:C.green}}/><div className="text-sm font-extrabold mt-2" style={{color:C.text}}>{rewardReady?"Reward ready":"6+ aur"}</div><div className="text-[10px]" style={{color:C.muted}}>10 correct milestone</div></GlassCard>
    </div>
    {rewardReady && <GlassCard className="p-4" style={{borderColor:`${C.green}66`}}><div className="flex gap-2"><CheckCircle2 size={18} style={{color:C.green}}/><div><div className="text-sm font-bold" style={{color:C.text}}>Reward unlock hua</div><div className="text-xs mt-1" style={{color:C.muted}}>Launch par reward coupon/discount admin se configure kiya ja sakta hai.</div></div></div></GlassCard>}
  </div>;
}
