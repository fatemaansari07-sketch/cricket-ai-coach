import { createClient } from '@supabase/supabase-js';
import { analyzeVideoWithGemini } from './lib/providers/gemini.js';

const reply = (res, status, body) => res.status(status).json(body);

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

    const { storagePath, category = 'batting', shotType = '', handedness = 'right' } = req.body || {};
    if (typeof storagePath !== 'string' || !storagePath.startsWith(`${authData.user.id}/`)) {
      return reply(res, 403, { error: 'Sirf apna uploaded video analyze kar sakte ho.' });
    }
    if (!['batting', 'bowling', 'fielding'].includes(category)) return reply(res, 400, { error: 'Invalid cricket category.' });

    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: profile, error: profileError } = await admin.from('profiles').select('plan_tier').eq('id', authData.user.id).single();
    if (profileError || !profile) return reply(res, 403, { error: 'Player profile nahi mila.' });
    const tier = profile.plan_tier || 'free';
    if (!['pro_99', 'video_499', 'special_coach'].includes(tier)) {
      return reply(res, 403, { error: 'AI visual analysis paid plans mein available hai. Free plan par local MediaPipe analysis use karo.' });
    }
    if (!process.env.GEMINI_API_KEY) return reply(res, 503, { error: 'AI analysis abhi configure nahi hai.' });

    const { data: blob, error: downloadError } = await admin.storage.from('videos').download(storagePath);
    if (downloadError || !blob) return reply(res, 404, { error: 'Uploaded video nahi mila.' });
    if (blob.size > 30 * 1024 * 1024) return reply(res, 413, { error: 'Video 30 MB se chhota rakho.' });
    const mimeType = blob.type || 'video/mp4';
    const buffer = Buffer.from(await blob.arrayBuffer());

    // Consume credits server-side only after identity, plan and file ownership are verified.
    const { data: creditData, error: creditError } = await authClient.rpc('consume_visual_credit');
    const credit = Array.isArray(creditData) ? creditData[0] : creditData;
    if (creditError) return reply(res, 503, { error: 'Credit system available nahi hai. Migration check karo.' });
    if (!credit?.allowed) return reply(res, 402, { error: credit?.reason === 'credits_exhausted' ? 'Is month ke visual credits khatam ho gaye.' : 'Visual credits available nahi hain.' });

    const ai = await analyzeVideoWithGemini(buffer, mimeType);
    const good = Array.isArray(ai.what_was_good) ? ai.what_was_good : [];
    const wrong = Array.isArray(ai.what_was_wrong) ? ai.what_was_wrong : [];
    const score = Math.max(0, Math.min(100, Math.round(Number(ai.score ?? (65 + good.length * 5 - wrong.length * 4)) || 60)));
    return reply(res, 200, {
      category,
      shotType: ai.shot_type || shotType || 'Cricket shot',
      score,
      correct: good,
      incorrect: wrong,
      confidence: ai.confidence === 'high' || ai.confidence === 'medium' ? ai.confidence : 'low',
      cameraAngleDetected: ai.camera_angle || null,
      creditsRemaining: Number(credit.remaining ?? 0),
      tier,
    });
  } catch (error) {
    console.error('Gemini video analysis failed:', error?.message || error);
    return reply(res, 500, { error: 'Video analysis fail hui. Dobara try karo.' });
  }
}
