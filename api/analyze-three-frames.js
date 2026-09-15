import { GoogleGenerativeAI } from '@google/generative-ai';

function cleanJson(text) { return JSON.parse(String(text||'').replace(/```json|```/g,'').trim()); }

async function openRouter(frames, category, shotType, handedness) {
  if (!process.env.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY missing');
  const content = [
    { type:'text', text:`You are a cricket coach. These are exactly three candidate frames: stance, impact, follow-through. Category=${category}; shot=${shotType}; handedness=${handedness}. Judge the visible technique only. Return ONLY JSON: {"what_was_good":[],"what_was_wrong":[],"summary":""}. Do not invent hidden details.` },
    ...frames.map((url,i)=>({ type:'image_url', image_url:{url}, _frame:i }))
  ];
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENROUTER_API_KEY}`,'Content-Type':'application/json','HTTP-Referer':process.env.APP_URL||'https://cricket-ai-coach.vercel.app','X-Title':'Cricket AI Coach'},body:JSON.stringify({model:process.env.OPENROUTER_MODEL||'openrouter/free',messages:[{role:'user',content}],temperature:0.2})});
  const j=await r.json(); if(!r.ok) throw new Error(j.error?.message||'OpenRouter request failed');
  return cleanJson(j.choices?.[0]?.message?.content);
}

export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  try{
    const {frames=[],category='batting',shotType='',handedness='right',provider=process.env.AI_PROVIDER||'gemini'}=req.body||{};
    if(frames.length!==3) return res.status(400).json({error:'Exactly 3 frames required'});
    if(provider==='openrouter') return res.status(200).json({provider:'openrouter',analysis:await openRouter(frames,category,shotType,handedness)});
    if(!process.env.GEMINI_API_KEY) return res.status(500).json({error:'GEMINI_API_KEY missing'});
    const ai=new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model=ai.getGenerativeModel({model:process.env.GEMINI_MODEL||'gemini-3.6-flash'});
    const parts=[{text:`Analyze these three cricket frames in order: stance, impact, follow-through. Category=${category}; shot=${shotType}; handedness=${handedness}. Return ONLY JSON: {"what_was_good":[],"what_was_wrong":[],"summary":""}. Judge visible technique only.`},...frames.map(x=>({inlineData:{data:String(x).split(',')[1],mimeType:'image/jpeg'}}))];
    const out=await model.generateContent(parts);
    return res.status(200).json({provider:'gemini',analysis:cleanJson(out.response.text())});
  }catch(e){console.error(e);return res.status(500).json({error:e.message||'3-frame analysis failed'});}
}
