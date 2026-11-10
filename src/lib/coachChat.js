export async function askCoach({ message, history = [], analysis = null, planTier, token }) {
  const res = await fetch('/api/coach-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ message, history, analysis, planTier }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Coach reply nahi aa paya.');
  return json;
}
