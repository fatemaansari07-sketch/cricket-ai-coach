import React,{useEffect,useRef} from 'react';
import {computeVideoFrameEvaluation} from '../data/biomechanics';
import {drawBallTrajectory,buildBallTrajectory} from '../lib/ballTracking';
import {estimatePitchLane,drawPitchLane} from '../lib/pitchGeometry';
import {C} from './ui';
import {LM} from '../lib/poseEstimation';

const BONES=[[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28],[0,11],[0,12]];
const key={headTiltDeg:'Head',frontElbowDeg:'Elbow',frontKneeDeg:'Knee'};
function p(l,i,w,h){const q=l?.[i];return q?{x:q.x*w,y:q.y*h}:null;}
function drawSkeleton(ctx,l,evaln,handedness,w,h){if(!l)return;const status=evaln?.jointStatus||{};const detail=evaln?.jointDetail||{};const frontLeft=handedness!=='left';const front=frontLeft?[11,13,15,23,25,27]:[12,14,16,24,26,28];
  ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
  for(const [a,b] of BONES){const A=p(l,a,w,h),B=p(l,b,w,h);if(!A||!B)continue;ctx.strokeStyle='rgba(148,163,184,.48)';ctx.lineWidth=Math.max(2,w/340);ctx.beginPath();ctx.moveTo(A.x,A.y);ctx.lineTo(B.x,B.y);ctx.stroke();}
  const groups=[{key:'headTiltDeg',pts:[0,11,12]},{key:'frontElbowDeg',pts:[front[0],front[1],front[2]]},{key:'frontKneeDeg',pts:[front[3],front[4],front[5]]}];
  for(const g of groups){const A=p(l,g.pts[0],w,h),B=p(l,g.pts[1],w,h),D=p(l,g.pts[2],w,h);if(!A||!B||!D)continue;const ok=status[g.key]!==false;const color=ok?C.green:C.red;ctx.strokeStyle=color;ctx.lineWidth=Math.max(3,w/190);ctx.beginPath();ctx.moveTo(A.x,A.y);ctx.lineTo(B.x,B.y);ctx.lineTo(D.x,D.y);ctx.stroke();ctx.fillStyle=color;ctx.beginPath();ctx.arc(B.x,B.y,Math.max(4,w/110),0,Math.PI*2);ctx.fill();const d=detail[g.key];if(d){const text=ok?`✓ ${key[g.key]} ${d.value}°`:`✗ ${key[g.key]} ${d.value}° (need ${d.min}-${d.max})`;ctx.font=`900 ${Math.max(11,w/54)}px sans-serif`;const tw=ctx.measureText(text).width;const x=Math.min(w-tw-14,Math.max(4,B.x+10)),y=Math.max(22,B.y-10);ctx.fillStyle='rgba(3,7,18,.86)';ctx.fillRect(x-5,y-18,tw+10,23);ctx.fillStyle=color;ctx.fillText(text,x,y);}}
  ctx.restore();
}
function drawCard(ctx,text,bad,w,h){ctx.save();ctx.font=`900 ${Math.max(13,w/38)}px sans-serif`;const tw=ctx.measureText(text).width;const x=(w-tw-28)/2,y=h-52;ctx.fillStyle=bad?'rgba(239,68,68,.92)':'rgba(16,185,129,.92)';ctx.beginPath();ctx.roundRect?ctx.roundRect(x,y,tw+28,34,9):ctx.rect(x,y,tw+28,34);ctx.fill();ctx.fillStyle='#fff';ctx.fillText(text,x+14,y+23);ctx.restore();}

export default function VideoAnalysisOverlay({file,frames,category='batting',handedness='right',ballTrack}){
 const vref=useRef(null),cref=useRef(null),raf=useRef(null); const framesRef=useRef(frames||[]); useEffect(()=>{framesRef.current=frames||[]},[frames]);
 useEffect(()=>{const v=vref.current,c=cref.current;if(!v||!c||!file)return;const url=URL.createObjectURL(file);v.src=url;v.muted=true;v.playsInline=true;const ctx=c.getContext('2d');const trail=ballTrack?.points?.length?ballTrack.points:(frames||[]).map(f=>f.ball).filter(Boolean);const trajectory=ballTrack?.trajectory||buildBallTrajectory(trail);const lane=estimatePitchLane(trajectory,frames||[]);let alive=true;
  const render=()=>{if(!alive)return;c.width=v.videoWidth||720;c.height=v.videoHeight||405;ctx.clearRect(0,0,c.width,c.height);ctx.drawImage(v,0,0,c.width,c.height);const fs=framesRef.current;if(fs.length){let best=fs[0];for(const f of fs){if(Math.abs(f.t-v.currentTime)<Math.abs(best.t-v.currentTime))best=f;}const ev=computeVideoFrameEvaluation(best.landmarks,category,handedness);drawPitchLane(ctx,lane,c.width,c.height);drawSkeleton(ctx,best.landmarks,ev,handedness,c.width,c.height);if(ev){const bad=Object.values(ev.jointStatus||{}).some(x=>x===false);const phase=ev.phase||'MOVEMENT';drawCard(ctx,bad?`✗ GALAT — ${ev.message||'Form check karo'}`:`✓ SAHI — ${ev.message||'Position theek hai'}`,bad,c.width,c.height);ctx.font=`800 ${Math.max(10,c.width/65)}px sans-serif`;ctx.fillStyle='rgba(3,7,18,.78)';ctx.fillRect(10,10,170,24);ctx.fillStyle='#fff';ctx.fillText(phase.toUpperCase(),18,27);}}
    drawBallTrajectory(ctx,trajectory,c.width,c.height);raf.current=requestAnimationFrame(render);};
  const onLoaded=()=>{render();v.play().catch(()=>{});};v.addEventListener('loadeddata',onLoaded);return()=>{alive=false;cancelAnimationFrame(raf.current);v.pause();v.removeEventListener('loadeddata',onLoaded);URL.revokeObjectURL(url);};},[file,category,handedness,ballTrack,frames]);
 return <div className="rounded-2xl overflow-hidden" style={{background:'#000'}}><canvas ref={cref} className="w-full block"/><video ref={vref} className="hidden" controls={false} playsInline muted/><div className="px-3 py-2 text-[10px]" style={{background:'#080C14',color:C.muted}}>🟠 Ball trajectory + tappa · 🟢 sahi · 🔴 galat · phases movement ke saath change hote hain</div></div>;
}
