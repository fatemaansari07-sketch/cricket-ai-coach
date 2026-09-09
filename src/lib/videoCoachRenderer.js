import { LM } from "./poseEstimation";
import { buildBallTrajectory, drawBallTrajectory } from "./ballTracking";
import { estimatePitchLane, drawPitchLane } from "./pitchGeometry";
import { computeVideoFrameEvaluation, IDEAL_RANGES, STANCE_RANGES, FOLLOW_THROUGH_RANGES } from "../data/biomechanics";

const BONES=[[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,25],[24,26],[25,27],[26,28],[23,24],[0,11],[0,12]];
const point=(l,i,w,h)=>l?.[i]?{x:l[i].x*w,y:l[i].y*h}:null;
function drawSkeleton(ctx,l,ev,handedness,w,h){if(!l)return;const front=handedness==='left'?[12,14,16,24,26,28]:[11,13,15,23,25,27];const groups=[['headTiltDeg',[0,11,12]],['frontElbowDeg',[front[0],front[1],front[2]]],['frontKneeDeg',[front[3],front[4],front[5]]]];ctx.save();ctx.lineCap='round';for(const[a,b]of BONES){const A=point(l,a,w,h),B=point(l,b,w,h);if(!A||!B)continue;ctx.strokeStyle='rgba(148,163,184,.48)';ctx.lineWidth=Math.max(2,w/350);ctx.beginPath();ctx.moveTo(A.x,A.y);ctx.lineTo(B.x,B.y);ctx.stroke();}for(const[k,ids]of groups){const A=point(l,ids[0],w,h),B=point(l,ids[1],w,h),D=point(l,ids[2],w,h);if(!A||!B||!D)continue;
  // No verdict for this joint this frame (either no evaluation is running
  // right now — transitional movement between key phases — or this
  // phase's rules don't judge this particular joint) -> neutral gray,
  // not a default green. A frame we never judged is not "correct".
  const hasVerdict = ev && k in (ev.jointStatus || {});
  const ok = hasVerdict ? ev.jointStatus[k] !== false : null;
  const color = ok === null ? 'rgba(148,163,184,.75)' : ok ? '#10B981' : '#EF4444';
  ctx.strokeStyle=color;ctx.lineWidth=Math.max(3,w/200);ctx.beginPath();ctx.moveTo(A.x,A.y);ctx.lineTo(B.x,B.y);ctx.lineTo(D.x,D.y);ctx.stroke();ctx.fillStyle=color;ctx.beginPath();ctx.arc(B.x,B.y,Math.max(4,w/115),0,Math.PI*2);ctx.fill();
  if(hasVerdict){const d=ev.jointDetail?.[k];if(d){const text=ok?`✓ ${d.value}°`:`✗ ${d.value}° (need ${d.min}-${d.max})`;ctx.font=`900 ${Math.max(11,w/58)}px sans-serif`;const tw=ctx.measureText(text).width;ctx.fillStyle='rgba(3,7,18,.86)';ctx.fillRect(B.x+8,B.y-20,tw+10,22);ctx.fillStyle=color;ctx.fillText(text,B.x+13,B.y-4);}}
}ctx.restore();}
function drawStatus(ctx,ev,phase,w,h){
  ctx.save();
  if(ev){
    // Only ever shown during a phase we actually judged (stance/impact/
    // follow-through) — see the phase gating in renderAnnotatedVideo.
    // Showing a pass/fail verdict on every frame of a continuous swing
    // used to flag totally normal mid-swing transitions as "GALAT" just
    // because they don't match the AT-IMPACT ideal angles.
    const bad=Object.values(ev.jointStatus||{}).some(v=>v===false);
    const text=bad?`✗ GALAT — ${ev.message||'Form check karo'}`:`✓ SAHI — ${ev.message||'Position theek hai'}`;
    ctx.font=`900 ${Math.max(12,w/44)}px sans-serif`;const tw=Math.min(w-40,ctx.measureText(text).width);const x=(w-tw-28)/2,y=h-52;
    ctx.fillStyle=bad?'rgba(239,68,68,.92)':'rgba(16,185,129,.92)';ctx.beginPath();ctx.roundRect?ctx.roundRect(x,y,tw+28,34,9):ctx.rect(x,y,tw+28,34);ctx.fill();ctx.fillStyle='#fff';ctx.fillText(text,x+14,y+23);
  }
  ctx.fillStyle='rgba(3,7,18,.82)';ctx.fillRect(12,12,170,24);ctx.fillStyle='#fff';ctx.font=`800 ${Math.max(10,w/70)}px sans-serif`;ctx.fillText(phase,20,29);
  ctx.restore();
}
function phaseAt(t,p){if(!p)return'MOVEMENT';if(t<=p.stanceSec)return'STANCE';if(t<=p.triggerSec)return'TRIGGER';if(t<=p.backswingSec)return'BACKSWING';if(t<=p.impactSec)return'IMPACT';return'FOLLOW-THROUGH';}

// A verdict (red/green + SAHI/GALAT card) only makes sense at the phases
// we actually have a rule set for — trying to judge mid-swing transition
// frames (TRIGGER/BACKSWING) against any fixed ideal is comparing the
// wrong moment to the wrong rule, which is what caused nonsense-looking
// flicker through the whole clip before.
function rulesForPhase(phase, category) {
  if (phase === "STANCE") return STANCE_RANGES[category];
  if (phase === "IMPACT") return IDEAL_RANGES[category];
  if (phase === "FOLLOW-THROUGH") return FOLLOW_THROUGH_RANGES[category];
  return null;
}

export async function renderAnnotatedVideo(file,frames,{brand='Cricket AI Coach',professional=false,ballTrack=null,category='batting',handedness='right',phaseDetection=null}={}){
 if(!file||!frames?.length||typeof MediaRecorder==='undefined')return null;
 const video=document.createElement('video');video.muted=true;video.playsInline=true;video.preload='auto';const url=URL.createObjectURL(file);video.src=url;
 await new Promise((res,rej)=>{video.onloadedmetadata=res;video.onerror=()=>rej(new Error('Video render load failed'));});
 const w=Math.min(960,video.videoWidth||720),h=Math.round(w*(video.videoHeight/video.videoWidth));const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');
 const stream=canvas.captureStream(12);const mime=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(x=>MediaRecorder.isTypeSupported(x));if(!mime){URL.revokeObjectURL(url);return null;}
 const rec=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:4_000_000}),chunks=[];rec.ondataavailable=e=>e.data.size&&chunks.push(e.data);const done=new Promise(resolve=>rec.onstop=()=>resolve(new Blob(chunks,{type:mime})));rec.start();
 const trail=(ballTrack?.points?.length?ballTrack.points:(frames||[]).map(f=>f.ball).filter(Boolean));const trajectory=ballTrack?.trajectory||buildBallTrajectory(trail);const lane=estimatePitchLane(trajectory,frames);
 const seek=t=>new Promise(resolve=>{const hnd=()=>{video.removeEventListener('seeked',hnd);resolve();};video.addEventListener('seeked',hnd,{once:true});video.currentTime=Math.min(t,Math.max(0,video.duration-.02));});
 for(let t=0;t<video.duration;t+=1/12){await seek(t);ctx.drawImage(video,0,0,w,h);const f=frames.reduce((b,x)=>!b||Math.abs(x.t-t)<Math.abs(b.t-t)?x:b,null);const phase=phaseAt(t,phaseDetection);const rules=rulesForPhase(phase,category);const ev=rules?computeVideoFrameEvaluation(f?.landmarks,category,handedness,rules):null;drawPitchLane(ctx,lane,w,h);drawSkeleton(ctx,f?.landmarks,ev,handedness,w,h);drawStatus(ctx,ev,phase,w,h);drawBallTrajectory(ctx,trajectory,w,h);if(professional){ctx.fillStyle='rgba(3,7,18,.84)';ctx.fillRect(12,h-92,310,30);ctx.fillStyle='#F59E0B';ctx.font=`900 ${Math.max(11,w/58)}px sans-serif`;ctx.fillText('BALL • RELEASE • BOUNCE • COACHING',22,h-72);}ctx.fillStyle='rgba(3,7,18,.84)';ctx.fillRect(w-210,12,198,30);ctx.fillStyle='#fff';ctx.font=`900 ${Math.max(11,w/62)}px sans-serif`;ctx.fillText(brand,w-198,33);}
 rec.stop();const blob=await done;URL.revokeObjectURL(url);return URL.createObjectURL(blob);
}
