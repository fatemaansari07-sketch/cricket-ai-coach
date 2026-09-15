import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

function cleanJson(text) {
  const raw = String(text || '').replace(/```json|```/g, '').trim();
  return JSON.parse(raw);
}

export const config = { api: { bodyParser: { sizeLimit: '1mb' } } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { storagePath, category='batting', shotType='', handedness='right', planType='free' } = req.body || {};
    if (planType === 'free') return res.status(403).json({ error: 'Free plan Gemini use nahi karta. MediaPipe local analysis use ho raha hai.' });
    if (!storagePath) return res.status(400).json({ error:'storagePath required' });
    if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error:'GEMINI_API_KEY missing' });
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    if (!url || !process.env.SUPABASE_SERVICE_ROLE_KEY) return res.status(500).json({ error:'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required for server video access' });
    const sb = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data: blob, error } = await sb.storage.from('videos').download(storagePath);
    if (error) throw error;
    const buffer = Buffer.from(await blob.arrayBuffer());
    const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = ai.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-3.6-flash' });
    const prompt = `You are a cricket biomechanics coach. Analyze this practice video. Category=${category}; selected shot=${shotType}; handedness=${handedness}. Return ONLY JSON with exactly three timestamps: {"shot_type":"","confidence":"high|medium|low","keyframes":{"stance":{"time_sec":0,"reason":""},"impact":{"time_sec":0,"reason":""},"followThrough":{"time_sec":0,"reason":""}},"analysis":{"what_was_good":[],"what_was_wrong":[],"summary":""}. Stance is the stable setup before movement. Impact is the closest defensible bat-ball contact; if uncertain say so. Follow-through is immediately after the shot. Never invent exact contact.`;
    const out = await model.generateContent([prompt, { inlineData:{data:buffer.toString('base64'),mimeType:blob.type||'video/mp4'} }]);
    return res.status(200).json(cleanJson(out.response.text()));
  } catch (e) {
    console.error('Gemini Analysis Error:', e);
    return res.status(500).json({ error:e.message || 'Gemini analysis failed' });
  }
}
