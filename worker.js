/**
 * SANA AI Proxy — Cloudflare Worker
 *
 * Deployment steps:
 *   1. Go to https://workers.cloudflare.com and create a free account
 *   2. Create a new Worker, paste this entire file
 *   3. Go to Settings → Variables → add a Secret named ANTHROPIC_API_KEY
 *      (get your key from https://console.anthropic.com)
 *   4. Deploy — copy your worker URL (e.g. https://sana-ai.YOUR-NAME.workers.dev)
 *   5. Paste that URL into index.html where it says SANA_AI_WORKER_URL
 *
 * The Anthropic API key never touches the browser — it lives only here.
 */

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request, env) {
    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    const { messages, system } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return json({ error: "messages array is required" }, 400);
    }

    if (!env.ANTHROPIC_API_KEY) {
      return json({ error: "ANTHROPIC_API_KEY secret not set on worker" }, 500);
    }

    // Forward to Anthropic
    let anthropicRes;
    try {
      anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type":      "application/json",
          "x-api-key":         env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model:      "claude-haiku-4-5-20251001",
          max_tokens: 350,
          system:     system || "",
          messages,
        }),
      });
    } catch (err) {
      return json({ error: `Upstream fetch failed: ${err.message}` }, 502);
    }

    const data = await anthropicRes.json();

    if (!anthropicRes.ok) {
      return json({ error: data.error?.message || `Anthropic error ${anthropicRes.status}` }, anthropicRes.status);
    }

    return json({ content: data.content?.[0]?.text ?? "" });
  },
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}
