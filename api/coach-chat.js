import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const reply = (res, status, body) => res.status(status).json(body);

/**
 * Coach Chat — special_coach (₹999) tier only.
 *
 * FIX: this file was missing entirely in this patch, even though
 * src/lib/coachChat.js still calls POST /api/coach-chat and PricingScreen
 * advertises "Coach Chat using history" as a special_coach feature.
 * Restored here in the same hardened style as the other AI endpoints in
 * this patch: the caller's session is verified server-side and the plan
 * tier is read from their profile row, never trusted from the request body
 * (the previous version of this file took `planTier` straight from
 * req.body, which let anyone claim special_coach for free).
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return reply(res, 405, { error: 'Method not allowed' });

  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return reply(res, 401, { error: 'Login required.' });

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !service) return reply(res, 500, { error: 'Server auth configuration missing.' });

  try {
    const authClient = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data: authData, error: authError } = await authClient.auth.getUser(token);
    if (authError || !authData?.user) return reply(res, 401, { error: 'Session invalid. Dobara login karo.' });

    const { message, history = [], analysis = null } = req.body || {};
    if (!message?.trim()) return reply(res, 400, { error: 'Message required.' });
    if (!Array.isArray(history)) return reply(res, 400, { error: 'Invalid history.' });

    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: profile, error: profileError } = await admin.from('profiles').select('plan_tier').eq('id', authData.user.id).single();
    if (profileError || !profile) return reply(res, 403, { error: 'Player profile nahi mila.' });
    const planTier = profile.plan_tier || 'free';
    if (planTier !== 'special_coach') return reply(res, 403, { error: 'Coach Chat ₹999 plan me available hai.' });
    if (!process.env.GEMINI_API_KEY) return reply(res, 503, { error: 'AI analysis abhi configure nahi hai.' });

    const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = ai.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-2.5-flash' });
    const context = analysis ? JSON.stringify(analysis).slice(0, 12000) : 'No current analysis attached.';
    const system = `You are Cricket AI Coach, a cricket-only personal coach. Stay focused on batting, bowling, fielding, fitness as it directly supports cricket, technique, drills, practice plans, progress and match preparation. Never pretend certainty where video data is weak. Use simple Hinglish. User plan: ${planTier}. Current analysis context: ${context}`;
    const contents = [
      { role: 'user', parts: [{ text: system }] },
      ...history.slice(-12).map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: String(m.content || '') }] })),
      { role: 'user', parts: [{ text: message }] },
    ];
    const out = await model.generateContent({ contents });
    return reply(res, 200, { reply: out.response.text() });
  } catch (error) {
    console.error('Coach chat failed:', error?.message || error);
    return reply(res, 500, { error: 'Coach chat fail hui. Dobara try karo.' });
  }
}
