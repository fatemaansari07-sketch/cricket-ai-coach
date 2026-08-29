import { createHash } from "crypto";

export function hashVideo(base64) {
  return createHash("sha256").update(base64).digest("hex");
}

export async function getCached(supabaseAdmin, videoHash) {
  const { data } = await supabaseAdmin
    .from("ai_analysis_cache")
    .select("result")
    .eq("video_hash", videoHash)
    .maybeSingle();
  return data?.result || null;
}

export async function setCached(supabaseAdmin, videoHash, engine, result) {
  await supabaseAdmin
    .from("ai_analysis_cache")
    .upsert({ video_hash: videoHash, engine, result }, { onConflict: "video_hash" });
}
