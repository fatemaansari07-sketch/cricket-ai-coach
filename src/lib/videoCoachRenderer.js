import { LM } from "./poseEstimation";
import { detectBallCandidate, buildBallTrajectory } from "./ballTracking";

const BONES = [
  [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER], [LM.LEFT_SHOULDER, LM.LEFT_ELBOW], [LM.LEFT_ELBOW, LM.LEFT_WRIST],
  [LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW], [LM.RIGHT_ELBOW, LM.RIGHT_WRIST],
  [LM.LEFT_SHOULDER, LM.LEFT_HIP], [LM.RIGHT_SHOULDER, LM.RIGHT_HIP], [LM.LEFT_HIP, LM.RIGHT_HIP],
  [LM.LEFT_HIP, LM.LEFT_KNEE], [LM.LEFT_KNEE, LM.LEFT_ANKLE], [LM.RIGHT_HIP, LM.RIGHT_KNEE], [LM.RIGHT_KNEE, LM.RIGHT_ANKLE],
  [LM.NOSE, LM.LEFT_SHOULDER], [LM.NOSE, LM.RIGHT_SHOULDER],
];

const LM_FRONT_RIGHT = { shoulder: LM.RIGHT_SHOULDER, elbow: LM.RIGHT_ELBOW, wrist: LM.RIGHT_WRIST, hip: LM.RIGHT_HIP, knee: LM.RIGHT_KNEE, ankle: LM.RIGHT_ANKLE };
const LM_FRONT_LEFT = { shoulder: LM.LEFT_SHOULDER, elbow: LM.LEFT_ELBOW, wrist: LM.LEFT_WRIST, hip: LM.LEFT_HIP, knee: LM.LEFT_KNEE, ankle: LM.LEFT_ANKLE };

/**
 * Canvas port of SkeletonOverlay's red/green pass-fail rendering — same
 * judgment (jointStatus/jointDetail), just drawn into the recorded video
 * instead of an SVG over a static photo. This is what was missing in the
 * moving replay: it showed angles as plain text, never "yeh sahi hai /
 * yeh galat hai" the way the still frames do.
 *
 * Only called for a short window around stance/impact/follow-through
 * (see keyMoments in renderAnnotatedVideo) — highlighting every single
 * frame of a continuous movement would just be visual noise.
 */
function drawFaultSkeleton(ctx, landmarks, jointStatus, jointDetail, handedness, w, h, faultLabel) {
  if (!landmarks || !jointStatus) { drawSkeleton(ctx, landmarks, w, h); return; }
  const isLeftFront = handedness !== "left";
  const front = isLeftFront ? LM_FRONT_LEFT : LM_FRONT_RIGHT;
  const okColor = "#10B981", badColor = "#EF4444", neutralColor = "#5B6472";

  const statusOf = (key) => (!(key in jointStatus) ? "neutral" : jointStatus[key] === false ? "bad" : "ok");
  const colorOf = (key) => { const s = statusOf(key); return s === "neutral" ? neutralColor : s === "bad" ? badColor : okColor; };
  const p = (i) => landmarks[i] ? { x: landmarks[i].x * w, y: landmarks[i].y * h } : null;

  const drawLine = (a, b, color) => { if (!a || !b) return; ctx.strokeStyle = color; ctx.lineWidth = Math.max(2.5, w / 220); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); };
  const drawDot = (a, color) => { if (!a) return; ctx.fillStyle = color; ctx.beginPath(); ctx.arc(a.x, a.y, Math.max(3, w / 160), 0, Math.PI * 2); ctx.fill(); };
  const drawJointLabel = (a, key, ok) => {
    if (!a) return;
    const d = jointDetail?.[key]; if (!d) return;
    const text = ok ? `OK ${d.value}°` : `X ${d.value}° (need ${d.min}-${d.max}°)`;
    ctx.font = `800 ${Math.max(11, w / 55)}px sans-serif`;
    const tw = ctx.measureText(text).width;
    ctx.fillStyle = "rgba(5,7,11,.82)"; ctx.fillRect(a.x + 6, a.y - 20, tw + 10, 20);
    ctx.fillStyle = ok ? okColor : badColor; ctx.fillText(text, a.x + 11, a.y - 5);
  };

  ctx.save();
  const midSh = { x: (p(LM.LEFT_SHOULDER)?.x + p(LM.RIGHT_SHOULDER)?.x) / 2, y: (p(LM.LEFT_SHOULDER)?.y + p(LM.RIGHT_SHOULDER)?.y) / 2 };
  const midHip = { x: (p(LM.LEFT_HIP)?.x + p(LM.RIGHT_HIP)?.x) / 2, y: (p(LM.LEFT_HIP)?.y + p(LM.RIGHT_HIP)?.y) / 2 };
  drawLine(midSh, midHip, neutralColor);
  drawLine(p(LM.LEFT_SHOULDER), p(LM.RIGHT_SHOULDER), neutralColor);
  drawLine(p(LM.LEFT_HIP), p(LM.RIGHT_HIP), neutralColor);

  const headColor = colorOf("headTiltDeg"), elbowColor = colorOf("frontElbowDeg"), kneeColor = colorOf("frontKneeDeg");
  drawLine(p(LM.NOSE), midSh, headColor); drawDot(p(LM.NOSE), headColor);
  drawJointLabel(p(LM.NOSE), "headTiltDeg", statusOf("headTiltDeg") !== "bad");

  drawLine(p(front.shoulder), p(front.elbow), elbowColor); drawLine(p(front.elbow), p(front.wrist), elbowColor);
  drawDot(p(front.elbow), elbowColor); drawDot(p(front.wrist), elbowColor);
  drawJointLabel(p(front.elbow), "frontElbowDeg", statusOf("frontElbowDeg") !== "bad");

  drawLine(p(front.hip), p(front.knee), kneeColor); drawLine(p(front.knee), p(front.ankle), kneeColor);
  drawDot(p(front.knee), kneeColor); drawDot(p(front.ankle), kneeColor);
  drawJointLabel(p(front.knee), "frontKneeDeg", statusOf("frontKneeDeg") !== "bad");
  ctx.restore();

  if (faultLabel) {
    ctx.save();
    const isBad = faultLabel.startsWith("GALAT");
    ctx.font = `800 ${Math.max(13, w / 34)}px sans-serif`;
    const tw = ctx.measureText(faultLabel).width;
    const x = w / 2 - (tw + 24) / 2, y = h - 56;
    ctx.fillStyle = isBad ? "rgba(239,68,68,.92)" : "rgba(16,185,129,.92)";
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, tw + 24, 32, 8) : ctx.rect(x, y, tw + 24, 32); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.fillText(faultLabel, x + 12, y + 21);
    ctx.restore();
  }
}

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

function drawBall(ctx, ball, trajectory, w, h) {
  if (!ball && !trajectory?.points?.length) return;
  ctx.save();

  // Smooth fitted arc (release -> bounce -> batsman) instead of a jagged
  // line through raw noisy detections — this is what actually produces a
  // real parabola with a visible bounce, like a broadcast trajectory graphic.
  if (trajectory?.curves?.length) {
    ctx.strokeStyle = "rgba(245,158,11,.9)";
    ctx.lineWidth = Math.max(2, w / 260);
    ctx.shadowColor = "rgba(245,158,11,.6)";
    ctx.shadowBlur = 6;
    for (const curve of trajectory.curves) {
      const steps = 24;
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const x = curve.from + (curve.to - curve.from) * (i / steps);
        const y = curve.fn.evaluate(x);
        if (i === 0) ctx.moveTo(x * w, y * h); else ctx.lineTo(x * w, y * h);
      }
      ctx.stroke();
    }
    ctx.shadowBlur = 0;

    const pts = trajectory.points;
    const markers = [{ p: pts[0], label: "RELEASE" }];
    if (trajectory.bounceIndex > 0) markers.push({ p: pts[trajectory.bounceIndex], label: "BOUNCE" });
    markers.push({ p: pts[pts.length - 1], label: "END" });
    ctx.font = `800 ${Math.max(9, w / 65)}px sans-serif`;
    markers.forEach(({ p, label }) => {
      if (!p) return;
      ctx.fillStyle = "rgba(5,7,11,.8)"; ctx.fillRect(p.x * w + 7, p.y * h - 15, 72, 20);
      ctx.fillStyle = "#fff"; ctx.fillText(label, p.x * w + 12, p.y * h - 1);
    });
  }

  if (ball) {
    ctx.fillStyle = "#f59e0b"; ctx.shadowColor = "#f59e0b"; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.arc(ball.x * w, ball.y * h, Math.max(5, w / 70), 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = "#fff"; ctx.font = `700 ${Math.max(11, w / 36)}px sans-serif`; ctx.fillText("BALL", ball.x * w + 8, ball.y * h - 8);
  }
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

export async function renderAnnotatedVideo(file, frames, { showAngles=true, brand="Cricket AI Coach", professional=false, keyMoments=[] }={}) {
  if (!file || !frames?.length || typeof MediaRecorder === "undefined") return null;
  const video=document.createElement("video"); video.muted=true; video.playsInline=true; video.preload="auto";
  const url=URL.createObjectURL(file); video.src=url;
  await new Promise((resolve,reject)=>{video.onloadedmetadata=resolve;video.onerror=()=>reject(new Error("Video render load failed"));});
  const w=Math.min(960,video.videoWidth||720), h=Math.round(w*(video.videoHeight/video.videoWidth));
  const duration=video.duration;

  const seekTo = (t) => new Promise((resolve) => {
    const on = () => { video.removeEventListener("seeked", on); resolve(); };
    video.addEventListener("seeked", on, { once: true });
    video.currentTime = Math.min(t, Math.max(0, duration - 0.02));
  });

  // PASS 1 — dense ball scan across the whole clip (independent of the
  // sparser pose-analysis frames), so the trajectory is built from a
  // smooth, evenly-spaced series instead of reused/duplicated positions.
  // This is what makes the fitted arc + bounce point accurate.
  const scanCanvas = document.createElement("canvas"); scanCanvas.width = w; scanCanvas.height = h;
  const scanCtx = scanCanvas.getContext("2d", { willReadFrequently: true });
  const ballTrail = [];
  let lastBall = null;
  const scanStep = Math.max(1 / 15, duration / 90); // ~90 samples across the clip, denser for shorter clips
  for (let t = 0; t < duration; t += scanStep) {
    await seekTo(t);
    scanCtx.drawImage(video, 0, 0, w, h);
    const ball = detectBallCandidate(scanCanvas, lastBall, { requireBallColor: false });
    if (ball) { ballTrail.push({ ...ball, t }); lastBall = ball; }
  }
  const trajectory = buildBallTrajectory(ballTrail);

  const canvas=document.createElement("canvas"); canvas.width=w;canvas.height=h; const ctx=canvas.getContext("2d");
  const stream=canvas.captureStream(12); const mime=["video/webm;codecs=vp9","video/webm;codecs=vp8","video/webm"].find(x=>MediaRecorder.isTypeSupported(x));
  if(!mime){URL.revokeObjectURL(url);return null;}
  const recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:3_000_000}); const chunks=[]; recorder.ondataavailable=e=>e.data.size&&chunks.push(e.data);
  const done=new Promise(resolve=>recorder.onstop=()=>resolve(new Blob(chunks,{type:mime})));
  recorder.start();

  const drawAt=async(t)=>{
    await seekTo(t);
    const frame=frames.reduce((best,f)=>!best||Math.abs(f.t-t)<Math.abs(best.t-t)?f:best,null);
    ctx.drawImage(video,0,0,w,h);

    // Key-frame lock: for a short window around stance/impact/follow-through
    // freeze the coach's actual pass/fail judgment on screen (red/green,
    // same as the static Stance/Impact/Follow-Through strip above) instead
    // of a plain moving skeleton — this is the "kahan galat, kahan sahi"
    // that a continuously-moving overlay can't show without cluttering
    // every frame of the clip.
    const HOLD_WINDOW = 0.45;
    const activeMoment = keyMoments.find((m) => m.atSeconds != null && Math.abs(t - m.atSeconds) <= HOLD_WINDOW);
    if (activeMoment) {
      drawFaultSkeleton(ctx, frame?.landmarks, activeMoment.jointStatus, activeMoment.jointDetail, activeMoment.handedness, w, h, activeMoment.label);
    } else {
      drawSkeleton(ctx,frame?.landmarks,w,h);
      if(showAngles)drawAngles(ctx,frame?.landmarks,w,h);
    }

    // Show the CURRENT ball position from the dense pre-scan (nearest in
    // time) plus the full fitted trajectory arc, once we're far enough
    // into the clip that a trajectory could plausibly exist yet.
    const nearestBall = ballTrail.reduce((best,b)=>!best||Math.abs(b.t-t)<Math.abs(best.t-t)?b:best, null);
    const showTrajectory = trajectory.points.length >= 4 && t >= trajectory.points[0].t;
    drawBall(ctx, nearestBall && Math.abs(nearestBall.t - t) < scanStep ? nearestBall : null, showTrajectory ? trajectory : null, w, h);

    if(professional && nearestBall){
      ctx.save(); ctx.fillStyle="rgba(5,7,11,.78)"; ctx.fillRect(12,h-58,300,40);
      ctx.fillStyle="#f59e0b"; ctx.font=`800 ${Math.max(12,w/42)}px sans-serif`; ctx.fillText("BALL TRACKING",22,h-34);
      ctx.fillStyle="#fff"; ctx.font=`600 ${Math.max(10,w/55)}px sans-serif`; ctx.fillText("Trajectory • release • bounce",22,h-18); ctx.restore();
    }
    ctx.fillStyle="rgba(5,7,11,.78)";ctx.fillRect(12,12,220,36);ctx.fillStyle="#fff";ctx.font="800 17px sans-serif";ctx.fillText(brand,22,36);
  };
  // Seek through the clip at 12fps for the actual recorded output. Pose is
  // sampled at analysis points and the nearest pose is reused between
  // points, keeping browser/GPU cost sane.
  for(let t=0;t<duration;t+=1/12){ await drawAt(t); }
  recorder.stop(); const blob=await done; URL.revokeObjectURL(url); return URL.createObjectURL(blob);
}
