/* Visual pitch/ball-lane geometry. It is deliberately confidence-gated:
   a lane is shown only when a coherent ball track exists. */
export function estimatePitchLane(trajectory, frames=[]) {
  const pts=trajectory?.points||[]; if(pts.length<5)return null;
  const first=pts[0],last=pts.at(-1), bounce=trajectory.bouncePoint||pts[Math.floor(pts.length*.55)];
  const width=(()=>{const p=frames.find(f=>f?.landmarks);if(!p)return .08;const a=p.landmarks[11],b=p.landmarks[12];return Math.max(.045,Math.min(.16,Math.hypot((a?.x||.45)-(b?.x||.55),(a?.y||.5)-(b?.y||.5))*2.2));})();
  const dx=last.x-first.x,dy=last.y-first.y,len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len;
  const near=(p,m)=>({x:Math.max(0,Math.min(1,p.x+nx*m)),y:Math.max(0,Math.min(1,p.y+ny*m))});
  return {confidence:pts.length>=10?'high':'medium',polygon:[near(first,width),near(first,-width),near(last,-width*.8),near(last,width*.8)],release:first,bounce};
}

export function drawPitchLane(ctx,lane,w,h){
  if(!lane)return;ctx.save();ctx.fillStyle='rgba(59,130,246,.10)';ctx.strokeStyle='rgba(96,165,250,.65)';ctx.lineWidth=Math.max(2,w/500);ctx.beginPath();lane.polygon.forEach((p,i)=>i?ctx.lineTo(p.x*w,p.y*h):ctx.moveTo(p.x*w,p.y*h));ctx.closePath();ctx.fill();ctx.stroke();
  ctx.font=`800 ${Math.max(9,w/72)}px sans-serif`;ctx.fillStyle='rgba(219,234,254,.9)';ctx.fillText('PITCH / BALL LANE',lane.polygon[0].x*w+8,lane.polygon[0].y*h+18);ctx.restore();
}
