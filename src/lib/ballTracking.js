/* Cricket-ball tracking utilities. Conservative by design: when evidence is weak,
   return no ball/no speed rather than inventing a number. */

function dist(a,b){ return Math.hypot((a?.x||0)-(b?.x||0),(a?.y||0)-(b?.y||0)); }

export function detectBallCandidate(canvas, previous=null, options={}) {
  if(!canvas?.width || !canvas?.height) return null;
  const roi=options.roi||{xMin:0.08,xMax:0.92,yMin:0.06,yMax:0.95};
  const strict=!!options.requireBallColor;
  const maxW=360, scale=Math.min(1,maxW/canvas.width);
  const w=Math.max(1,Math.round(canvas.width*scale)), h=Math.max(1,Math.round(canvas.height*scale));
  const small=document.createElement('canvas'); small.width=w; small.height=h;
  const ctx=small.getContext('2d',{willReadFrequently:true}); ctx.drawImage(canvas,0,0,w,h);
  const {data}=ctx.getImageData(0,0,w,h); const visited=new Uint8Array(w*h), candidates=[];
  const x0=Math.max(1,Math.floor(roi.xMin*w)), x1=Math.min(w-1,Math.ceil(roi.xMax*w));
  const y0=Math.max(1,Math.floor(roi.yMin*h)), y1=Math.min(h-1,Math.ceil(roi.yMax*h));
  const ballPixel=(i)=>{
    const r=data[i],g=data[i+1],b=data[i+2],mx=Math.max(r,g,b),mn=Math.min(r,g,b);
    const white=mx>185 && (mx-mn)<58;
    const red=r>105 && r-g>38 && r-b>38;
    return strict ? (white||red) : white;
  };
  const dirs=[[1,0],[-1,0],[0,1],[0,-1]];
  for(let y=y0;y<y1;y+=2) for(let x=x0;x<x1;x+=2){
    const start=y*w+x; if(visited[start]||!ballPixel(start*4)) continue;
    const q=[[x,y]]; visited[start]=1; let n=0,sx=0,sy=0,minX=x,maxX=x,minY=y,maxY=y;
    while(q.length && n<160){ const [cx,cy]=q.pop(); n++; sx+=cx; sy+=cy; minX=Math.min(minX,cx);maxX=Math.max(maxX,cx);minY=Math.min(minY,cy);maxY=Math.max(maxY,cy);
      for(const [dx,dy] of dirs){const nx=cx+dx,ny=cy+dy;if(nx<1||nx>=w-1||ny<1||ny>=h-1)continue;const ni=ny*w+nx;if(!visited[ni]&&ballPixel(ni*4)){visited[ni]=1;q.push([nx,ny]);}}
    }
    const bw=maxX-minX+1,bh=maxY-minY+1,compact=Math.min(bw,bh)/Math.max(bw,bh);
    const minArea=strict?3:2,maxArea=strict?70:95,minCompact=strict?.62:.48;
    if(n>=minArea&&n<=maxArea&&bw<=20&&bh<=20&&compact>=minCompact){
      candidates.push({x:(sx/n)/w,y:(sy/n)/h,area:n,compact,radiusFrac:Math.sqrt(n/(w*h*Math.PI))});
    }
  }
  if(!candidates.length) return null;
  let best=null,bestScore=-Infinity;
  for(const c of candidates){
    let s=c.compact*2+Math.min(c.area/18,2);
    if(previous){
      const d=dist(c,previous); s+=Math.max(0,2.8-d*6);
      const ratio=c.area/Math.max(1,previous.area);
      if(ratio>2.6||ratio<.38) s-=5;
    }
    if(strict && c.compact<.72) s-=1;
    if(s>bestScore){bestScore=s;best=c;}
  }
  const threshold=strict?2.35:1.7;
  if(bestScore<threshold) return null;
  return {...best,confidence:Math.min(1,bestScore/(strict?7:6))};
}

export function smoothBallTrack(points){
  const out=points.filter(Boolean); if(out.length<2)return out;
  return out.map((p,i)=>{if(p)return p;let a=i-1,b=i+1;while(a>=0&&!points[a])a--;while(b<points.length&&!points[b])b++;if(a<0||b>=points.length)return null;const t=(i-a)/(b-a);return{x:points[a].x+(points[b].x-points[a].x)*t,y:points[a].y+(points[b].y-points[a].y)*t,confidence:Math.min(points[a].confidence||0,points[b].confidence||0)*.7};}).filter(Boolean);
}

function localExtremumBounce(points){
  if(points.length<5)return -1;
  const y=points.map(p=>p.y); const sm=y.map((_,i)=>{const a=y[Math.max(0,i-2)],b=y[Math.max(0,i-1)],c=y[i],d=y[Math.min(y.length-1,i+1)],e=y[Math.min(y.length-1,i+2)];return(a+b+c+d+e)/5;});
  let best=-1,bestScore=-Infinity;
  for(let i=2;i<sm.length-2;i++){
    const left=sm[i]-sm[i-2], right=sm[i+2]-sm[i];
    if(left>0 && right<0){ const score=(left-right)*1.2 + sm[i]*.25; if(score>bestScore){bestScore=score;best=i;} }
  }
  return best;
}

// Catmull-Rom gives a smooth curve even when screen X is not monotonic.
function catmull(a,b,c,d,t){const t2=t*t,t3=t2*t;return .5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t2+(-a+3*b-3*c+d)*t3);}
export function buildBallTrajectory(trail){
  const pts=trail.filter(Boolean); if(pts.length<4)return{bounceIndex:-1,bouncePoint:null,points:pts,curvePoints:pts};
  const bounceIndex=localExtremumBounce(pts);
  const curvePoints=[];
  for(let i=0;i<pts.length-1;i++){
    const p0=pts[Math.max(0,i-1)],p1=pts[i],p2=pts[i+1],p3=pts[Math.min(pts.length-1,i+2)];
    for(let s=0;s<8;s++){const t=s/8;curvePoints.push({x:catmull(p0.x,p1.x,p2.x,p3.x,t),y:catmull(p0.y,p1.y,p2.y,p3.y,t)});}
  }
  curvePoints.push(pts[pts.length-1]);
  return {bounceIndex,bouncePoint:bounceIndex>=0?pts[bounceIndex]:null,points:pts,curvePoints};
}

export function trackBallFromPoseFrames(frames){
  const points=(frames||[]).map(f=>f?.ball?{...f.ball,t:f.t}:null).filter(Boolean);
  if(points.length<4)return {points:[],trajectory:buildBallTrajectory([]),speed:null,confidence:'low'};
  // Split accidental jumps into the longest coherent track.
  let best=[],cur=[points[0]];
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i], dt=Math.max(.001,b.t-a.t), jump=dist(a,b);
    if(dt<.5 && jump<.20) cur.push(b); else {if(cur.length>best.length)best=cur;cur=[b];}
  }
  if(cur.length>best.length)best=cur;
  const clean=smoothBallTrack(best);
  if(clean.length<4) return {points:[],trajectory:buildBallTrajectory([]),speed:null,confidence:'low'};
  let travel=0; for(let i=1;i<clean.length;i++) travel+=dist(clean[i],clean[i-1]);
  const displacement=dist(clean[0],clean.at(-1));
  // A stationary bright patch is not a ball track. Require real motion.
  if(travel<0.08 || displacement<0.035) return {points:[],trajectory:buildBallTrajectory([]),speed:null,confidence:'low'};
  const trajectory=buildBallTrajectory(clean);
  return {points:clean,trajectory,speed:null,confidence:clean.length>=8?'high':clean.length>=5?'medium':'low'};
}

export function estimateDeliverySpeedKmh(samples,distanceMeters){
  const clean=(samples||[]).filter(s=>s&&s.radiusFrac>0&&Number.isFinite(s.t));
  if(clean.length<6||!distanceMeters)return null;
  const seconds=(clean.at(-1).t-clean[0].t)/1000; if(seconds<.22||seconds>2.2)return null;
  const growth=clean.at(-1).radiusFrac/Math.max(.0001,clean[0].radiusFrac); if(growth<1.22)return null;
  let reversals=0; for(let i=1;i<clean.length;i++) if(clean[i].radiusFrac<clean[i-1].radiusFrac*.86)reversals++;
  if(reversals>Math.ceil(clean.length*.25))return null;
  const kmh=(distanceMeters/seconds)*3.6; if(kmh<35||kmh>165)return null;
  return {kmh:Math.round(kmh),confidence:clean.length>=10&&reversals<=1?'high':'medium'};
}

export function estimateBallSpeedFromTrack(points,distanceMeters){
  if(!points||points.length<6||!distanceMeters)return null;
  const a=points[0],b=points.at(-1),dt=(b.t-a.t)/1000; if(dt<.22||dt>2.2)return null;
  const kmh=distanceMeters/dt*3.6; if(kmh<35||kmh>165)return null;
  return {kmh:Math.round(kmh),confidence:points.length>=10?'high':'medium'};
}

export function drawBallTrajectory(ctx,trajectory,w,h){
  if(!trajectory?.curvePoints?.length)return;
  ctx.save();ctx.strokeStyle='rgba(245,158,11,.95)';ctx.lineWidth=Math.max(3,w/240);ctx.lineCap='round';ctx.shadowColor='rgba(245,158,11,.45)';ctx.shadowBlur=8;
  ctx.beginPath();trajectory.curvePoints.forEach((p,i)=>i?ctx.lineTo(p.x*w,p.y*h):ctx.moveTo(p.x*w,p.y*h));ctx.stroke();ctx.shadowBlur=0;
  const bp=trajectory.bouncePoint;if(bp){ctx.fillStyle='rgba(245,158,11,.20)';ctx.beginPath();ctx.arc(bp.x*w,bp.y*h,Math.max(16,w/28),0,Math.PI*2);ctx.fill();ctx.fillStyle='#F59E0B';ctx.beginPath();ctx.arc(bp.x*w,bp.y*h,Math.max(7,w/65),0,Math.PI*2);ctx.fill();ctx.font=`900 ${Math.max(12,w/48)}px sans-serif`;ctx.fillStyle='#fff';ctx.fillText('BOUNCE / TAPPA',bp.x*w+12,bp.y*h-10);}
  const first=trajectory.points[0],last=trajectory.points.at(-1);ctx.font=`800 ${Math.max(10,w/62)}px sans-serif`;
  if(first){ctx.fillStyle='rgba(5,7,11,.78)';ctx.fillRect(first.x*w+7,first.y*h-22,78,20);ctx.fillStyle='#fff';ctx.fillText('RELEASE',first.x*w+12,first.y*h-7);}
  if(last){ctx.fillStyle='rgba(5,7,11,.78)';ctx.fillRect(last.x*w+7,last.y*h+5,72,20);ctx.fillStyle='#fff';ctx.fillText('BALL',last.x*w+12,last.y*h+20);}
  ctx.restore();
}
