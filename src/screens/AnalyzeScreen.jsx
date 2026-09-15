import React, { useState } from "react";
import { Upload, Play, Sparkles, AlertCircle, Lock, Camera, CheckCircle2, Video as VideoIcon } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { extractPoseSequenceFromVideo, captureFrameDataUrl, analyzeFrameDataUrl, LM } from "../lib/poseEstimation";
import { evaluatePoseSequence } from "../data/biomechanics";
import { DAILY_LIMITS, SHOT_TYPES, needsQuotaReset } from "../data/limits";
import { runCoachingLoop } from "../lib/coachSession";
import { trackBallFromPoseFrames, analyzeBallLine } from "../lib/ballTracking";
import { hasVisualAI, hasVideoVisualization } from "../data/plans";
import CoachResultScreen from "./CoachResultScreen";
import { C, GlassCard, SolidButton, AdSlot, Pill, InfoHint, SettingsCard } from "../components/ui";

export default function AnalyzeScreen({ isPaid, onPlanReady, setTab }) {
  const { user, profile, refreshProfile } = useAuth();
  const [started,setStarted]=useState(false), [category,setCategory]=useState("batting"), [handedness,setHandedness]=useState("right"), [shotType,setShotType]=useState(SHOT_TYPES.batting[0]);
  const [file,setFile]=useState(null), [result,setResult]=useState(null), [step,setStep]=useState(""), [loading,setLoading]=useState(false), [error,setError]=useState(null), [showResultAd,setShowResultAd]=useState(false);
  const [videoThumb,setVideoThumb]=useState(null), [stanceThumb,setStanceThumb]=useState(null), [followThroughThumb,setFollowThroughThumb]=useState(null);
  const [videoThumbAspect,setVideoThumbAspect]=useState(null), [stanceThumbAspect,setStanceThumbAspect]=useState(null), [followThroughThumbAspect,setFollowThroughThumbAspect]=useState(null);
  const [videoThumbNeutral,setVideoThumbNeutral]=useState(null), [stanceThumbNeutral,setStanceThumbNeutral]=useState(null), [followThroughThumbNeutral,setFollowThroughThumbNeutral]=useState(null);
  const [geminiVisual,setGeminiVisual]=useState(false), [visualPending,setVisualPending]=useState(false), [ballTrack,setBallTrack]=useState(null);

  const tier=profile?.plan_tier||"free", isFree=tier==="free", visualAI=hasVisualAI(tier), videoAI=hasVideoVisualization(tier);
  const visualCredits=Number(profile?.visual_credits_remaining||0);
  const usedToday=needsQuotaReset(profile)?0:(profile?.videos_analyzed_today||0), limit=DAILY_LIMITS[tier]??5, quotaLeft=Math.max(0,limit-usedToday), quotaHit=quotaLeft<=0;
  const heavyAds=isFree&&!profile?.academy_id;
  const changeCategory=c=>{setCategory(c);setShotType(SHOT_TYPES[c][0]);setResult(null)};

  const handleFile=e=>{const f=e.target.files?.[0];if(!f)return;setFile(f);setResult(null);setError(null);setBallTrack(null);setGeminiVisual(false);setVisualPending(false);setVideoThumb(null);setStanceThumb(null);setFollowThroughThumb(null);setVideoThumbAspect(null);setStanceThumbAspect(null);setFollowThroughThumbAspect(null);setVideoThumbNeutral(null);setStanceThumbNeutral(null);setFollowThroughThumbNeutral(null)};

  const bumpQuota=async()=>{const today=new Date().toISOString().slice(0,10);const count=needsQuotaReset(profile)?1:(profile?.videos_analyzed_today||0)+1;await supabase.from("profiles").update({videos_analyzed_today:count,videos_quota_reset_at:today}).eq("id",user.id);await refreshProfile()};

  const saveAnalysis=async(r, storagePath="local-only")=>{
    const {data:videoRow,error:ve}=await supabase.from("videos").insert({user_id:user.id,storage_path:storagePath,category,shot_type:shotType,duration_seconds:10}).select().single();
    if(ve) throw ve;
    const {data:row,error:ae}=await supabase.from("analyses").insert({video_id:videoRow.id,user_id:user.id,category:r.category,score:r.score,correct_points:r.correct||[],incorrect_points:r.incorrect||[],issues:r.issues||[],pose_keypoints:{angles:r.angles,phases:r.phases},model_version:r.modelVersion||"mediapipe-local-v2"}).select().single();
    if(ae) throw ae; return row;
  };

  const localAnalyze=async()=>{
    setStep("MediaPipe se poori shot check kar raha hoon...");
    const frames=await extractPoseSequenceFromVideo(file,32,null,category);
    if(!frames?.length) throw new Error("Video me poora body clearly nahi dikha. Side-on angle, achhi light aur stable phone ke saath dubara try karo.");
    setStep("Ball aur movement track kar raha hoon...");
    const trackedBall=trackBallFromPoseFrames(frames);setBallTrack(trackedBall);
    let r=evaluatePoseSequence(frames,category,handedness);r.analysisFrames=frames;r.ballTrack=trackedBall;r.pitchTrack=trackedBall?.trajectory?.points||[];r.modelVersion="mediapipe-local-v2";
    if(r.skeletonLandmarks){const h1=r.skeletonLandmarks[LM.LEFT_HIP],h2=r.skeletonLandmarks[LM.RIGHT_HIP],a1=r.skeletonLandmarks[LM.LEFT_ANKLE],a2=r.skeletonLandmarks[LM.RIGHT_ANKLE];r.ballLine=analyzeBallLine(trackedBall?.trajectory,h1&&h2?(h1.x+h2.x)/2:null,a1&&a2?(a1.y+a2.y)/2:null)}
    const capture=async(sec,landmarks)=>{if(sec==null)return null;try{const c=await captureFrameDataUrl(file,sec,landmarks);return {...c,aspect:c.width/c.height}}catch{return null}};
    const mid=await capture(r.skeletonAtSeconds,r.skeletonLandmarks), st=await capture(r.stanceSkeleton?.atSeconds,r.stanceSkeleton?.landmarks), ft=await capture(r.followThroughSkeleton?.atSeconds,r.followThroughSkeleton?.landmarks);
    if(mid){setVideoThumb(mid.dataUrl);setVideoThumbAspect(mid.aspect);setVideoThumbNeutral(mid.neutralColor)}
    if(st){setStanceThumb(st.dataUrl);setStanceThumbAspect(st.aspect);setStanceThumbNeutral(st.neutralColor)}
    if(ft){setFollowThroughThumb(ft.dataUrl);setFollowThroughThumbAspect(ft.aspect);setFollowThroughThumbNeutral(ft.neutralColor)}
    return r;
  };

  const runGeminiVisual=async(r, storagePath)=>{
    const provider=import.meta.env.VITE_AI_PROVIDER||"gemini";
    if(provider==="openrouter"){
      setStep("3 coaching frames local MediaPipe se prepare kar raha hoon...");
      const capture=async(sec)=>{const c=await captureFrameDataUrl(file,Number(sec),null);return c.dataUrl};
      const frames=[await capture(r.stanceSkeleton?.atSeconds),await capture(r.skeletonAtSeconds),await capture(r.followThroughSkeleton?.atSeconds)];
      setStep("Free OpenRouter vision model se visual coaching check ho raha hai...");
      const {data:{session}}=await supabase.auth.getSession();
      const res=await fetch("/api/analyze-three-frames",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session?.access_token||""}`},body:JSON.stringify({frames,category,shotType,handedness,provider:"openrouter"})});
      const json=await res.json(); if(!res.ok) throw new Error(json.error||"OpenRouter visual analysis fail ho gayi.");
      r.visualGemini=json.analysis;r.modelVersion="openrouter-free+mediapipe-keyframes";
      r.correct=[...(r.correct||[]),...(json.analysis?.what_was_good||[])].slice(0,8);
      r.incorrect=[...(r.incorrect||[]),...(json.analysis?.what_was_wrong||[])].slice(0,8);
      return r;
    }
    setStep("Gemini 3 key moments select kar raha hai...");
    const {data:{session}}=await supabase.auth.getSession();
    const res=await fetch("/api/analyze-video-gemini",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session?.access_token||""}`},body:JSON.stringify({storagePath,category,shotType,handedness,planType:tier})});
    const json=await res.json(); if(!res.ok) throw new Error(json.error||"Gemini visual analysis fail ho gayi.");
    const k=json.keyframes||{};
    setStep("Gemini ke selected 3 frames par MediaPipe skeleton laga raha hoon...");
    const phase=async(sec)=>{const c=await captureFrameDataUrl(file,Number(sec),null);const fr=await analyzeFrameDataUrl(c.dataUrl,Number(sec));const ev=evaluatePoseSequence([fr],category,handedness);return {dataUrl:c.dataUrl,aspect:c.width/c.height,neutral:c.neutralColor,frame:fr,eval:ev}};
    const st=await phase(k.stance?.time_sec), im=await phase(k.impact?.time_sec), ft=await phase(k.followThrough?.time_sec);
    setStanceThumb(st.dataUrl);setStanceThumbAspect(st.aspect);setStanceThumbNeutral(st.neutral);setVideoThumb(im.dataUrl);setVideoThumbAspect(im.aspect);setVideoThumbNeutral(im.neutral);setFollowThroughThumb(ft.dataUrl);setFollowThroughThumbAspect(ft.aspect);setFollowThroughThumbNeutral(ft.neutral);
    const visualScore=Math.round((st.eval.score+im.eval.score+ft.eval.score)/3);
    r.score=Math.round((r.score+visualScore)/2);r.phases={stance:st.eval.score,midShot:im.eval.score,followThrough:ft.eval.score};r.visualKeyframes={stance:st,impact:im,followThrough:ft};r.visualGemini=json.analysis;r.modelVersion="gemini-3.6-flash+mediapipe-keyframes";
    r.stanceSkeleton={landmarks:st.frame.landmarks,atSeconds:st.frame.t,jointStatus:st.eval.jointStatus,jointDetail:st.eval.jointDetail};
    r.skeletonLandmarks=im.frame.landmarks;r.skeletonAtSeconds=im.frame.t;r.jointStatus=im.eval.jointStatus;r.jointDetail=im.eval.jointDetail;
    r.followThroughSkeleton={landmarks:ft.frame.landmarks,atSeconds:ft.frame.t,jointStatus:ft.eval.jointStatus,jointDetail:ft.eval.jointDetail};
    r.correct=[...(r.correct||[]),...(json.analysis?.what_was_good||[])].slice(0,8);r.incorrect=[...(r.incorrect||[]),...(json.analysis?.what_was_wrong||[])].slice(0,8);r.geminiKeyframes=k;r.issues=r.issues||[];
    return r;
  };

  const analyze=async(visualChoice=false)=>{
    if(!file||!user||quotaHit)return;
    if(visualChoice && isFree){ setError("Free plan me Gemini/paid AI use nahi hota. MediaPipe local analysis hi chalega."); return; }
    setLoading(true);setError(null);setResult(null);setGeminiVisual(visualChoice);
    try{
      const isPaidVisual=visualChoice&&visualAI;
      let storagePath="local-only";
      if(isPaidVisual||videoAI){setStep("Video secure storage me upload ho raha hai...");storagePath=`${user.id}/${Date.now()}-${file.name}`;const {error}=await supabase.storage.from("videos").upload(storagePath,file,{upsert:false});if(error)throw error}
      const r=await localAnalyze();
      if(isPaidVisual){r.issues=r.issues||[];await runGeminiVisual(r,storagePath)}
      const row=await saveAnalysis(r,storagePath);await bumpQuota();
      const coaching=await runCoachingLoop({supabase,user,category,analysisId:row.id,evalResult:r});
      coaching.analysisFile=file;coaching.analysisFrames=r.analysisFrames||[];coaching.ballTrack=r.ballTrack||null;coaching.phaseDetection=r.phaseDetection||null;coaching.videoCreditPlan=tier;coaching.visualKeyframes=r.visualKeyframes||null;coaching.geminiKeyframes=r.geminiKeyframes||null;coaching.visualGemini=r.visualGemini||null;coaching.handedness=handedness;
      setResult(coaching);setShowResultAd(heavyAds);
    }catch(e){setError(e.message||"Kuch galat ho gaya, dubara try karo.")}finally{setLoading(false);setStep("")}
  };

  if(result)return <CoachResultScreen coaching={result} shotType={shotType} onPlanReady={()=>setTab("plan")} showAd={showResultAd} planTier={tier} onUpgrade={()=>setTab("pricing")} videoThumb={videoThumb} videoThumbAspect={videoThumbAspect} videoThumbNeutral={videoThumbNeutral} stanceThumb={stanceThumb} stanceThumbAspect={stanceThumbAspect} stanceThumbNeutral={stanceThumbNeutral} followThroughThumb={followThroughThumb} followThroughThumbAspect={followThroughThumbAspect} followThroughThumbNeutral={followThroughThumbNeutral} analysisFile={result.analysisFile} analysisFrames={result.analysisFrames} ballTrack={result.ballTrack} phaseDetection={result.phaseDetection} profile={profile} onCreditsChanged={refreshProfile}/>

  return <div className="space-y-3">
    <div className="flex items-center justify-between"><h2 className="text-2xl font-extrabold" style={{color:C.text}}>Analyze</h2><span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{color:quotaHit?C.red:C.muted,background:"rgba(255,255,255,.04)"}}>{usedToday}/{limit}</span></div>
    <p className="text-xs -mt-2" style={{color:C.muted}}>Ek hi shot ka clean ~10 sec video do. Free me MediaPipe local analysis; paid visual mode me Gemini + MediaPipe.</p>
    <InfoHint icon={Camera}>Side-on/square-leg angle, poora body frame me, stable phone, achhi lighting. Camera ko zoom ya move mat karo.</InfoHint>
    {quotaHit?<GlassCard className="p-6 text-center"><Lock className="mx-auto mb-2" size={20} style={{color:C.gold}}/><div className="text-sm font-semibold" style={{color:C.text}}>Aaj ki limit khatam</div><SolidButton tone="gold" className="mt-4" onClick={()=>setTab("pricing")}>Upgrade Karo</SolidButton></GlassCard>:!started?<div className="flex flex-col items-center text-center py-10 gap-5"><div className="w-16 h-16 rounded-full flex items-center justify-center" style={{background:"rgba(16,185,129,.12)"}}><Play size={26} style={{color:C.green}}/></div><div><div className="text-base font-bold" style={{color:C.text}}>Naya session</div><div className="text-xs mt-1 max-w-[260px]" style={{color:C.muted}}>Pehle shot aur recording rules samjho, phir video upload karo.</div></div><button onClick={()=>setStarted(true)} className="px-8 py-4 rounded-2xl font-bold text-sm" style={{background:C.green,color:"#06110B"}}>Analysis Shuru Karo</button></div>:<>
      <SettingsCard>
        <div className="flex gap-2">{["batting","bowling","fielding"].map(c=><Pill key={c} active={category===c} onClick={()=>changeCategory(c)}>{c[0].toUpperCase()+c.slice(1)}</Pill>)}</div>
        <select value={shotType} onChange={e=>setShotType(e.target.value)} className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none" style={{background:"rgba(0,0,0,.3)",border:`1px solid ${C.border}`,color:C.text}}>{(isFree?SHOT_TYPES[category].slice(0,6):SHOT_TYPES[category]).map(s=><option key={s} value={s}>{s}</option>)}</select>
        <div className="text-[10px]" style={{color:C.muted}}>Free me selected shot hi analyze hoga. AI tiers me bhi selected shot ko context ke liye bheja jayega.</div>
        <div className="flex gap-2"><Pill active={handedness==="right"} onClick={()=>setHandedness("right")}>Right-handed</Pill><Pill active={handedness==="left"} onClick={()=>setHandedness("left")}>Left-handed</Pill></div>
        <label className="block rounded-xl p-4 cursor-pointer" style={{border:`1px dashed ${C.border}`,background:"rgba(255,255,255,.02)"}}><input type="file" accept="video/*" onChange={handleFile} className="hidden"/><div className="flex items-center gap-3"><Upload size={18} style={{color:C.green}}/><div><div className="text-sm font-bold" style={{color:C.text}}>{file?file.name:"10-second video choose karo"}</div><div className="text-[10px] mt-1" style={{color:C.muted}}>MP4/MOV · stable · full body</div></div></div></label>
      </SettingsCard>
      {file&&<GlassCard className="p-4"><div className="text-sm font-bold" style={{color:C.text}}>Analysis choice</div><div className="text-xs mt-1" style={{color:C.muted}}>Free analysis sabko milega. Paid visual me Gemini ke 3 selected moments par skeleton/angles milenge — 10 visual credits.</div>
        <div className="grid grid-cols-1 gap-2 mt-3"><SolidButton tone="green" disabled={loading} onClick={()=>analyze(false)}><CheckCircle2 size={16}/>{loading?step||"Analyzing...":"Free/Local Analysis"}</SolidButton>
        {visualAI&&<>{visualCredits>0?<SolidButton tone="gold" disabled={loading} onClick={()=>{setVisualPending(true)}}><Sparkles size={16}/>{loading?"Please wait":`Visual analysis chahiye — 10 credits (${visualCredits} left)`}</SolidButton>:<button onClick={async()=>{const {data}=await supabase.rpc("recharge_visual_credits",{p_amount:100});if(data?.allowed)await refreshProfile()}} className="w-full rounded-xl py-2.5 text-xs font-bold" style={{background:"rgba(245,158,11,.12)",border:`1px solid ${C.gold}44`,color:C.gold}}>Recharge Visual Credits ₹99 → 100 credits</button>}</>}
        {videoAI&&<div className="text-[10px] flex items-center gap-1" style={{color:C.muted}}><VideoIcon size={11}/> Video credit result ke baad alag se poocha jayega. Abhi koi video credit nahi katega.</div>}</div>
      </GlassCard>}
      {visualPending&&<GlassCard className="p-4" style={{border:`1px solid ${C.gold}66`}}><div className="text-sm font-extrabold" style={{color:C.text}}>Visual analysis confirm?</div><div className="text-xs mt-1" style={{color:C.muted}}>Gemini sirf 3 moments select karega: Stance, Impact, Follow-through. Phir MediaPipe un 3 images par skeleton + angles check karega. <b>10 visual credits</b> lagenge.</div><div className="flex gap-2 mt-3"><SolidButton tone="gold" onClick={()=>{setVisualPending(false);analyze(true)}}>Haan, Visual Analysis</SolidButton><button onClick={()=>setVisualPending(false)} className="px-4 rounded-xl text-xs font-bold" style={{background:C.cardSolid,border:`1px solid ${C.border}`,color:C.text}}>Cancel</button></div></GlassCard>}
      {loading&&<GlassCard className="p-4"><div className="text-xs" style={{color:C.muted}}>{step||"Analysis chal raha hai..."}</div></GlassCard>}
      {error&&<div className="flex items-start gap-2 text-xs rounded-xl p-3" style={{background:"rgba(239,68,68,.08)",color:C.red,border:`1px solid ${C.red}33`}}><AlertCircle size={14}/><span>{error}</span></div>}
      <AdSlot label="Sponsored — free users" />
    </>}
  </div>;
}
