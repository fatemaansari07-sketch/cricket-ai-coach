import { createClient } from "@supabase/supabase-js";

/**
 * Runs automatically once a day (see vercel.json).
 * Deletes only the raw video FILE from storage after 7 days.
 * The `videos` row, and everything in `analyses` / `practice_plans`
 * (scores, feedback text, angles, drills) stays forever — those are tiny
 * and are the whole point of the app's history, so we never touch them.
 */
export default async function handler(req, res) {
  // Only Vercel Cron (or someone with the secret) can trigger this
  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY // service role: server-only, never exposed to the browser
  );

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: oldVideos, error: fetchError } = await supabaseAdmin
    .from("videos")
    .select("id, storage_path")
    .lt("created_at", sevenDaysAgo)
    .is("deleted_at", null)
    .limit(500);

  if (fetchError) {
    return res.status(500).json({ error: fetchError.message });
  }

  if (!oldVideos || oldVideos.length === 0) {
    return res.status(200).json({ deleted: 0 });
  }

  const paths = oldVideos.map((v) => v.storage_path).filter(Boolean);
  if (paths.length > 0) {
    await supabaseAdmin.storage.from("videos").remove(paths);
  }

  const ids = oldVideos.map((v) => v.id);
  await supabaseAdmin
    .from("videos")
    .update({ storage_path: null, deleted_at: new Date().toISOString() })
    .in("id", ids);

  return res.status(200).json({ deleted: ids.length });
}
