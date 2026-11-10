export async function requestThreeFrameAnalysis({ file, storagePath, category = 'batting', shotType = '', handedness = 'right', supabase, token }) {
  let path = storagePath;
  const session = (await supabase?.auth.getSession())?.data?.session;
  if (!path && file && supabase) {
    if (!session?.user?.id) throw new Error('Login required to upload a coaching video.');
    const { data, error } = await supabase.storage.from('videos').upload(`${session.user.id}/${crypto.randomUUID()}-${file.name}`, file, { upsert: false });
    if (error) throw error;
    path = data.path;
  }
  const authToken = token || session?.access_token;
  const res = await fetch('/api/analyze-three-frames', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
    body: JSON.stringify({ storagePath: path, category, shotType, handedness }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || '3-frame analysis fail ho gayi.');
  return json;
}
