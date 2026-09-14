import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { message, history = [], analysis = null, planTier = 'free' } = req.body || {};
    if (!message?.trim()) return res.status(400).json({ error: 'Message required' });
    if (!['special_coach'].includes(planTier)) return res.status(403).json({ error: 'Coach Chat ₹999 plan me available hai.' });
    if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY missing' });
    const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = ai.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-2.5-flash' });
    const context = analysis ? JSON.stringify(analysis).slice(0, 12000) : 'No current analysis attached.';
    const system = `You are Cricket AI Coach, a cricket-only personal coach. Stay focused on batting, bowling, fielding, fitness as it directly supports cricket, technique, drills, practice plans, progress and match preparation. Never pretend certainty where video data is weak. Use simple Hinglish. User plan: ${planTier}. Current analysis context: ${context}`;
    const contents = [{ role: 'user', parts: [{ text: system }] }, ...history.slice(-12).map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: String(m.content || '') }] })), { role: 'user', parts: [{ text: message }] }];
    const out = await model.generateContent({ contents });
    return res.status(200).json({ reply: out.response.text() });
  } catch (e) { console.error(e); return res.status(500).json({ error: e.message || 'Coach chat failed' }); }
}
