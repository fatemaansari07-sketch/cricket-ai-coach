import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const respond = (res, status, body) => res.status(status).json(body);
function cleanJson(text) { return JSON.parse(String(text).replace(/```json|```/g, '').trim()); }

export default async function handler(req, res) {
  if (req.method !== 'POST') return respond(res, 405, { error: 'Method not allowed' });
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return respond(res, 401, { error: 'Login required.' });
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !service) return respond(res, 500, { error: 'Server auth configuration missing.' });
  try {
    const authClient = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data: authData, error: authError } = await authClient.auth.getUser(token);
    if (authError || !authData?.user) return respond(res, 401, { error: 'Session invalid. Dobara login karo.' });
    const { storagePath, category = 'batting', shotType = '', handedness = 'right' } = req.body || {};
    if (typeof storagePath !== 'string' || !storagePath.startsWith(`${authData.user.id}/`)) return respond(res, 403, { error: 'Sirf apna uploaded video analyze kar sakte ho.' });
    if (!['batting', 'bowling', 'fielding'].includes(category)) return respond(res, 400, { error: 'Invalid cricket category.' });
    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: profile, error: profileError } = await admin.from('profiles').select('plan_tier').eq('id', authData.user.id).single();
    if (profileError || !profile) return respond(res, 403, { error: 'Player profile nahi mila.' });
    if (!['pro_99', 'video_499', 'special_coach'].includes(profile.plan_tier)) return respond(res, 403, { error: '3-frame AI analysis paid plan mein available hai.' });
    if (!process.env.GEMINI_API_KEY) return respond(res, 503, { error: 'AI analysis abhi configure nahi hai.' });
    const { data: blob, error } = await admin.storage.from('videos').download(storagePath);
    if (error || !blob) return respond(res, 404, { error: 'Uploaded video nahi mila.' });
    if (blob.size > 30 * 1024 * 1024) return respond(res, 413, { error: 'Video 30 MB se chhota rakho.' });
    const { data: creditData, error: creditError } = await authClient.rpc('consume_visual_credit');
    const credit = Array.isArray(creditData) ? creditData[0] : creditData;
    if (creditError) return respond(res, 503, { error: 'Credit system available nahi hai. Migration check karo.' });
    if (!credit?.allowed) return respond(res, 402, { error: 'Visual credits available nahi hain.' });
    const buffer = Buffer.from(await blob.arrayBuffer());
    const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = ai.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-2.5-flash' });
    const prompt = `You are a cricket biomechanics coach. Analyze this cricket practice video. Category=${category}, selected shot=${shotType}, handedness=${handedness}. Identify the best timestamps for exactly three coaching frames: stance (stable setup before movement), impact/contact (closest defensible bat-ball contact moment; if uncertain say so), follow-through (immediately after shot, balance visible). Return ONLY JSON: {"shot_type":"","confidence":"high|medium|low","frames":{"stance":{"time_sec":0,"reason":""},"impact":{"time_sec":0,"reason":""},"follow_through":{"time_sec":0,"reason":""}},"notes":[]}. Do not invent exact contact if video does not show it.`;
    const out = await model.generateContent([prompt, { inlineData: { data: buffer.toString('base64'), mimeType: blob.type || 'video/mp4' } }]);
    return respond(res, 200, { ...cleanJson(out.response.text()), creditsRemaining: Number(credit.remaining ?? 0) });
  } catch (error) {
    console.error('Three-frame analysis failed:', error?.message || error);
    return respond(res, 500, { error: '3-frame analysis fail hui. Dobara try karo.' });
  }
}
