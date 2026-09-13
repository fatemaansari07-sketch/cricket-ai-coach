import React, { useEffect, useRef, useState } from "react";
import { Camera, Gauge, Play, Square, RotateCcw } from "lucide-react";
import { C, GlassCard, SolidButton } from "../components/ui";
import { detectBallCandidate } from "../lib/ballTracking";

/**
 * Phone-as-speed-gun prototype. It runs locally: the camera stays on the
 * phone and only lightweight ball candidates are inspected. Because a phone
 * camera does not measure Doppler speed, the number is explicitly labelled an
 * estimate and is based on the selected delivery distance + observed flight
 * time. This avoids pretending it is a radar-gun measurement.
 */
export default function SpeedGunScreen() {
  const videoRef = useRef(null); const canvasRef = useRef(null); const rafRef = useRef(null);
  const streamRef = useRef(null); const stateRef = useRef({ active:false, first:null, last:null, lastBall:null });
  const [running,setRunning]=useState(false); const [distance,setDistance]=useState(15); const [speed,setSpeed]=useState(null); const [status,setStatus]=useState("Camera ready");
  const [detected,setDetected]=useState(false);

  const stop = () => { if(rafRef.current) cancelAnimationFrame(rafRef.current); rafRef.current=null; streamRef.current?.getTracks().forEach(t=>t.stop()); streamRef.current=null; setRunning(false); stateRef.current={active:false,first:null,last:null,lastBall:null}; };
  useEffect(()=>()=>stop(),[]);
  const start = async () => {
    try {
      stop(); setSpeed(null); setStatus("Bowler ko camera me rakho...");
      const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"},width:{ideal:1280},height:{ideal:720}},audio:false});
      streamRef.current=stream; videoRef.current.srcObject=stream; await videoRef.current.play(); setRunning(true); stateRef.current.active=true; loop();
    } catch { setStatus("Camera permission nahi mili. Browser settings me Camera allow karo."); }
  };
  const loop = () => {
    const v=videoRef.current,c=canvasRef.current; if(!v||!c||!stateRef.current.active)return;
    c.width=Math.min(640,v.videoWidth||640); c.height=Math.round(c.width*((v.videoHeight||360)/(v.videoWidth||640)));
    const ctx=c.getContext("2d");ctx.drawImage(v,0,0,c.width,c.height);
    const ball=detectBallCandidate(c,stateRef.current.lastBall);
    if(ball){ stateRef.current.lastBall=ball; setDetected(true); const now=performance.now(); if(!stateRef.current.first) { stateRef.current.first=now; setStatus("Ball detected — delivery track ho rahi hai..."); } stateRef.current.last=now; }
    else setDetected(false);
    if(stateRef.current.first&&stateRef.current.last&&stateRef.current.last-stateRef.current.first>180){
      const seconds=(stateRef.current.last-stateRef.current.first)/1000; const kmh=(distance/seconds)*3.6; if(kmh>20&&kmh<220) setSpeed(Math.round(kmh));
      // Reset after a completed delivery; user can immediately measure again.
      stateRef.current.first=null;stateRef.current.last=null;stateRef.current.lastBall=null;
    }
    rafRef.current=requestAnimationFrame(loop);
  };
  return <div className="space-y-4">
    <div className="flex items-center gap-2"><Gauge size={22} style={{color:C.gold}}/><div><h2 className="text-2xl font-extrabold" style={{color:C.text}}>Live Speed Gun</h2><p className="text-xs" style={{color:C.muted}}>Phone camera se local speed estimate</p></div></div>
    <GlassCard className="p-3"><div className="relative overflow-hidden rounded-xl bg-black"><video ref={videoRef} muted playsInline className="w-full"/><canvas ref={canvasRef} className="hidden"/><div className="absolute inset-x-0 top-0 p-3 flex justify-between"><span className="text-[10px] font-bold px-2 py-1 rounded-full" style={{background:"rgba(5,7,11,.75)",color:detected?C.green:C.text}}>{detected?"● BALL DETECTED":"● SEARCHING"}</span>{running&&<span className="text-[10px] px-2 py-1 rounded-full" style={{background:"rgba(5,7,11,.75)",color:C.text}}>LIVE</span>}</div></div></GlassCard>
    <GlassCard className="p-4 text-center"><div className="text-[10px] uppercase tracking-widest" style={{color:C.muted}}>Estimated Ball Speed</div><div className="text-6xl font-black my-2" style={{color:speed?C.gold:C.text}}>{speed??"—"}</div><div className="text-sm font-bold" style={{color:C.muted}}>KM/H</div>{speed&&<div className="text-[10px] mt-2" style={{color:C.muted}}>Camera/time based estimate — radar gun reading nahi.</div>}</GlassCard>
    <GlassCard className="p-4"><div className="text-xs font-bold mb-2" style={{color:C.text}}>Delivery distance</div><div className="flex gap-2 flex-wrap">{[10,12,15,18,20].map(d=><button key={d} onClick={()=>setDistance(d)} className="px-3 py-2 rounded-xl text-xs font-bold" style={{background:distance===d?C.gold:C.cardSolid,color:distance===d?"#0B0F17":C.text,border:`1px solid ${distance===d?C.gold:C.border}`}}>{d}m</button>)}</div><div className="text-[10px] mt-2" style={{color:C.muted}}>{status}</div></GlassCard>
    <div className="flex gap-2"><SolidButton tone="green" onClick={running?stop:start} className="flex-1">{running?<><Square size={15}/> Stop</>:<><Play size={15}/> Start Speed Gun</>}</SolidButton><button onClick={()=>{setSpeed(null);setStatus("Ready")}} className="w-12 rounded-2xl flex items-center justify-center" style={{background:C.cardSolid,border:`1px solid ${C.border}`}}><RotateCcw size={16} style={{color:C.text}}/></button></div>
    <div className="text-[10px] flex gap-2 p-3 rounded-xl" style={{background:"rgba(245,158,11,.06)",border:`1px solid ${C.gold}33`,color:C.muted}}><Camera size={13} style={{color:C.gold}}/> Best result ke liye phone ko stable rakho aur bowler/ball ko poore frame me rakho. Box-cricket distance select karo.</div>
  </div>;
}
