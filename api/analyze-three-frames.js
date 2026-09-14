import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

function cleanJson(text) { return JSON.parse(String(text).replace(/```json|```/g, '').trim()); }
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { storagePath, category = 'batting', shotType = '', handedness = 'right' } = req.body || {};
    if (!storagePath) return res.status(400).json({ error: 'storagePath required' });
    if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY missing' });
    const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data: blob, error } = await supabase.storage.from('videos').download(storagePath);
    if (error) throw error;
    const mimeType = blob.type || 'video/mp4';
    const buffer = Buffer.from(await blob.arrayBuffer());
    const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = ai.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-2.5-flash' });
    const prompt = `You are a cricket biomechanics coach. Analyze this single cricket practice video. Category=${category}, selected shot=${shotType}, handedness=${handedness}. Identify the best timestamps for exactly three coaching frames: stance (stable setup before movement), impact/contact (closest defensible bat-ball contact moment; if uncertain say so), follow-through (immediately after shot, balance visible). Return ONLY JSON: {"shot_type":"","confidence":"high|medium|low","frames":{"stance":{"time_sec":0,"reason":""},"impact":{"time_sec":0,"reason":""},"follow_through":{"time_sec":0,"reason":""}},"notes":[]}. Do not invent exact contact if video does not show it.`;
    const out = await model.generateContent([prompt, { inlineData: { data: buffer.toString('base64'), mimeType } }]);
    return res.status(200).json(cleanJson(out.response.text()));
  } catch (e) { console.error(e); return res.status(500).json({ error: e.message || '3-frame analysis failed' }); }
}
