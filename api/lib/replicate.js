const API = 'https://api.replicate.com/v1';
export async function runReplicate(model, input) {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error('REPLICATE_API_TOKEN missing');
  const res = await fetch(`${API}/models/${model}/predictions`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ input }) });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.detail || data?.error || `Replicate error ${res.status}`);
  return data;
}
export async function getReplicatePrediction(id) {
  const token = process.env.REPLICATE_API_TOKEN;
  const res = await fetch(`${API}/predictions/${id}`, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.detail || `Replicate error ${res.status}`);
  return data;
}
