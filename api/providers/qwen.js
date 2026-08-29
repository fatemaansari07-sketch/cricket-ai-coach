/**
 * Qwen2.5-VL provider — same shape as gemini.js (generate({base64, mimeType,
 * prompt}) -> raw text) so the route can switch providers via one env var
 * without any other code changing.
 *
 * Per the project's phased plan: Colab is for BENCHMARKING ONLY, never the
 * permanent backend. Once a real inference endpoint exists (GPU box, RunPod,
 * whatever fits the budget), point QWEN_ENDPOINT at it and this becomes live.
 * Until then it fails loudly instead of silently returning nonsense.
 */
export async function generate({ base64, mimeType, prompt }) {
  const endpoint = process.env.QWEN_ENDPOINT;
  if (!endpoint) {
    throw new Error(
      "Qwen provider not configured — set QWEN_ENDPOINT once benchmarking against Gemini is done. Falling back to Gemini for now."
    );
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, mimeType, videoBase64: base64 }),
  });

  if (!res.ok) {
    throw new Error(`Qwen endpoint returned ${res.status}`);
  }

  const data = await res.json();
  // Expected shape from the inference server: { text: "<model output>" }
  return data.text;
}

export const name = "qwen2.5-vl";
