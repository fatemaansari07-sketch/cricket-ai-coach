import { GoogleGenerativeAI } from '@google/generative-ai';

async function openRouter(message, history, analysis, planTier){
  if(!process.env.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY missing');
  const system=`You are Cricket AI Coach, a cricket-only personal coach. Stay focused on batting, bowling, fielding, cricket fitness, technique, drills, practice plans, progress and match preparation. Use simple Hinglish. Never invent certainty. Plan=${planTier}. Current analysis=${JSON.stringify(analysis||{}).slice(0,12000)}`;
  const messages=[{role:'system',content:system},...history.slice(-12).map(m=>({role:m.role==='assistant'?'assistant':'user',content:String(m.content||'')})),{role:'user',content:message}];
  const r=await fetch('https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENROUTER_API_KEY}`,'Content-Type':'application/json','HTTP-Referer':process.env.APP_URL||'https://cricket-ai-coach.vercel.app','X-Title':'Cricket AI Coach'},body:JSON.stringify({model:process.env.OPENROUTER_MODEL||'openrouter/free',messages,temperature:0.5})});
  const j=await r.json();if(!r.ok)throw new Error(j.error?.message||'OpenRouter request failed');return j.choices?.[0]?.message?.content||'';
}

export default async function handler(req,res){
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 try{
  const {message,history=[],analysis=null,planTier='free'}=req.body||{};
  if(!message?.trim())return res.status(400).json({error:'Message required'});
  if(planTier!=='special_999')return res.status(403).json({error:'Coach Chat ₹999 plan me available hai.'});
  if((process.env.AI_PROVIDER||'gemini')==='openrouter') return res.status(200).json({reply:await openRouter(message,history,analysis,planTier)});
  if(!process.env.GEMINI_API_KEY)return res.status(500).json({error:'GEMINI_API_KEY missing'});
  const ai=new GoogleGenerativeAI(process.env.GEMINI_API_KEY);const model=ai.getGenerativeModel({model:process.env.GEMINI_MODEL||'gemini-3.6-flash'});
  const system=`You are Cricket AI Coach, a cricket-only personal coach. Stay focused on cricket technique, drills, practice plans and progress. Use simple Hinglish. Plan=${planTier}. Current analysis=${JSON.stringify(analysis||{}).slice(0,12000)}`;
  const contents=[{role:'user',parts:[{text:system}]},...history.slice(-12).map(m=>({role:m.role==='assistant'?'model':'user',parts:[{text:String(m.content||'')}] })),{role:'user',parts:[{text:message}]}];
  const out=await model.generateContent({contents});return res.status(200).json({reply:out.response.text()});
 }catch(e){console.error(e);return res.status(500).json({error:e.message||'Coach chat failed'});}
}
