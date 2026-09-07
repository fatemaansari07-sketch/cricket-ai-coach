import { LM } from "./poseEstimation";

const BONES = [
  [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER], [LM.LEFT_SHOULDER, LM.LEFT_ELBOW], [LM.LEFT_ELBOW, LM.LEFT_WRIST],
  [LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW], [LM.RIGHT_ELBOW, LM.RIGHT_WRIST],
  [LM.LEFT_SHOULDER, LM.LEFT_HIP], [LM.RIGHT_SHOULDER, LM.RIGHT_HIP], [LM.LEFT_HIP, LM.RIGHT_HIP],
  [LM.LEFT_HIP, LM.LEFT_KNEE], [LM.LEFT_KNEE, LM.LEFT_ANKLE], [LM.RIGHT_HIP, LM.RIGHT_KNEE], [LM.RIGHT_KNEE, LM.RIGHT_ANKLE],
  [LM.NOSE, LM.LEFT_SHOULDER], [LM.NOSE, LM.RIGHT_SHOULDER],
];

function drawSkeleton(ctx, landmarks, w, h) {
  if (!landmarks) return;
  ctx.save(); ctx.lineWidth = Math.max(2, w / 320); ctx.lineCap = "round";
  for (const [a,b] of BONES) {
    const p=landmarks[a], q=landmarks[b]; if (!p||!q) continue;
    ctx.strokeStyle = "rgba(16,185,129,.9)"; ctx.beginPath(); ctx.moveTo(p.x*w,p.y*h); ctx.lineTo(q.x*w,q.y*h); ctx.stroke();
  }
  for (const i of [LM.NOSE,LM.LEFT_SHOULDER,LM.RIGHT_SHOULDER,LM.LEFT_ELBOW,LM.RIGHT_ELBOW,LM.LEFT_WRIST,LM.RIGHT_WRIST,LM.LEFT_HIP,LM.RIGHT_HIP,LM.LEFT_KNEE,LM.RIGHT_KNEE,LM.LEFT_ANKLE,LM.RIGHT_ANKLE]) {
    const p=landmarks[i]; if(!p) continue; ctx.fillStyle="#fff"; ctx.beginPath(); ctx.arc(p.x*w,p.y*h,Math.max(2,w/150),0,Math.PI*2); ctx.fill();
  }
  ctx.restore();
}

function drawBall(ctx, ball, trail, w, h) {
  if (!ball) return;
  ctx.save();
  if (trail?.length > 1) {
    ctx.strokeStyle = "rgba(245,158,11,.9)"; ctx.lineWidth = Math.max(2, w/300); ctx.setLineDash([8,6]);
    ctx.beginPath(); trail.forEach((p,i)=>{ if(i===0)ctx.moveTo(p.x*w,p.y*h); else ctx.lineTo(p.x*w,p.y*h); }); ctx.stroke();
    const bounce = trail.findIndex((p,i)=>i>1 && trail[i-1].y < p.y && trail[i+1]?.y < p.y);
    const markers = [{p:trail[0],label:"RELEASE"}];
    if (bounce > 0) markers.push({p:trail[bounce],label:"BOUNCE"});
    markers.push({p:trail[trail.length-1],label:"END"});
    ctx.setLineDash([]); ctx.font=`800 ${Math.max(9,w/65)}px sans-serif`;
    markers.forEach(({p,label})=>{ctx.fillStyle="rgba(5,7,11,.8)";ctx.fillRect(p.x*w+7,p.y*h-15,72,20);ctx.fillStyle="#fff";ctx.fillText(label,p.x*w+12,p.y*h-1);});
  }
  ctx.fillStyle="#f59e0b"; ctx.shadowColor="#f59e0b"; ctx.shadowBlur=12;
  ctx.beginPath(); ctx.arc(ball.x*w,ball.y*h,Math.max(5,w/70),0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0;
  ctx.fillStyle="#fff"; ctx.font=`700 ${Math.max(11,w/36)}px sans-serif`; ctx.fillText("BALL",ball.x*w+8,ball.y*h-8);
  ctx.restore();
}

function drawAngles(ctx, landmarks, w, h) {
  if (!landmarks) return;
  const angle = (a,b,c) => {
    const A=landmarks[a],B=landmarks[b],C=landmarks[c]; if(!A||!B||!C)return null;
    const ab={x:A.x-B.x,y:A.y-B.y}, cb={x:C.x-B.x,y:C.y-B.y};
    const d=ab.x*cb.x+ab.y*cb.y, m=Math.hypot(ab.x,ab.y)*Math.hypot(cb.x,cb.y); if(!m)return null;
    return Math.round(Math.acos(Math.max(-1,Math.min(1,d/m)))*180/Math.PI);
  };
  const head = landmarks[LM.NOSE], ls=landmarks[LM.LEFT_SHOULDER], rs=landmarks[LM.RIGHT_SHOULDER];
  const headDeg=head&&ls&&rs?Math.round(Math.atan2(head.x-(ls.x+rs.x)/2, ((ls.y+rs.y)/2)-head.y)*180/Math.PI):null;
  const elbow=angle(LM.LEFT_SHOULDER,LM.LEFT_ELBOW,LM.LEFT_WRIST), knee=angle(LM.LEFT_HIP,LM.LEFT_KNEE,LM.LEFT_ANKLE);
  const rows=[[`Head ${headDeg ?? "—"}°`,head], [`Elbow ${elbow ?? "—"}°`,landmarks[LM.LEFT_ELBOW]], [`Knee ${knee ?? "—"}°`,landmarks[LM.LEFT_KNEE]]];
  ctx.save(); ctx.font=`700 ${Math.max(12,w/42)}px monospace`;
  rows.forEach(([text,p],i)=>{if(!p)return; const x=Math.min(w-150,p.x*w+12), y=Math.max(20,p.y*h-10); ctx.fillStyle="rgba(5,7,11,.75)"; ctx.fillRect(x-5,y-15,145,22); ctx.fillStyle="#fff";ctx.fillText(text,x,y);}); ctx.restore();
}

export async function renderAnnotatedVideo(file, frames, { showAngles=true, brand="Cricket AI Coach", professional=false }={}) {
  if (!file || !frames?.length || typeof MediaRecorder === "undefined") return null;
  const video=document.createElement("video"); video.muted=true; video.playsInline=true; video.preload="auto";
  const url=URL.createObjectURL(file); video.src=url;
  await new Promise((resolve,reject)=>{video.onloadedmetadata=resolve;video.onerror=()=>reject(new Error("Video render load failed"));});
  const w=Math.min(960,video.videoWidth||720), h=Math.round(w*(video.videoHeight/video.videoWidth));
  const canvas=document.createElement("canvas"); canvas.width=w;canvas.height=h; const ctx=canvas.getContext("2d");
  const stream=canvas.captureStream(12); const mime=["video/webm;codecs=vp9","video/webm;codecs=vp8","video/webm"].find(x=>MediaRecorder.isTypeSupported(x));
  if(!mime){URL.revokeObjectURL(url);return null;}
  const recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:3_000_000}); const chunks=[]; recorder.ondataavailable=e=>e.data.size&&chunks.push(e.data);
  const done=new Promise(resolve=>recorder.onstop=()=>resolve(new Blob(chunks,{type:mime})));
  recorder.start();
  const start=performance.now(); const duration=video.duration;
  let trail=[];
  const drawAt=async(t)=>{
    await new Promise((resolve)=>{ const on=()=>{video.removeEventListener("seeked",on);resolve();};video.addEventListener("seeked",on,{once:true});video.currentTime=Math.min(t,Math.max(0,duration-0.02)); });
    const frame=frames.reduce((best,f)=>!best||Math.abs(f.t-t)<Math.abs(best.t-t)?f:best,null);
    ctx.drawImage(video,0,0,w,h); drawSkeleton(ctx,frame?.landmarks,w,h);
    if(frame?.ball){trail=[...trail.slice(-10),frame.ball];drawBall(ctx,frame.ball,trail,w,h);} 
    if(showAngles)drawAngles(ctx,frame?.landmarks,w,h);
    if(professional && frame?.ball){
      ctx.save(); ctx.fillStyle="rgba(5,7,11,.78)"; ctx.fillRect(12,h-58,300,40);
      ctx.fillStyle="#f59e0b"; ctx.font=`800 ${Math.max(12,w/42)}px sans-serif`; ctx.fillText("BALL TRACKING",22,h-34);
      ctx.fillStyle="#fff"; ctx.font=`600 ${Math.max(10,w/55)}px sans-serif`; ctx.fillText("Trajectory • release • bounce candidate",22,h-18); ctx.restore();
    }
    ctx.fillStyle="rgba(5,7,11,.78)";ctx.fillRect(12,12,220,36);ctx.fillStyle="#fff";ctx.font="800 17px sans-serif";ctx.fillText(brand,22,36);
  };
  // Seek through the clip at 12fps. Pose is sampled at analysis points and
  // the nearest pose is reused between points, keeping browser/GPU cost sane.
  for(let t=0;t<duration;t+=1/12){ await drawAt(t); }
  recorder.stop(); const blob=await done; URL.revokeObjectURL(url); return URL.createObjectURL(blob);
}
