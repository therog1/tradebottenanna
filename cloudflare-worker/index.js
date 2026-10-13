/**
 * TradebottenAnna Gemini advice API.
 * Required Cloudflare Secret: GEMINI_API_KEY
 * Protect this Worker hostname with Cloudflare Access and allow only your Google identity.
 * This API provides advice only; it cannot access OKX or submit orders.
 */
const ALLOWED_ORIGINS = new Set([
  "https://therog1.github.io"
]);
const KEYS = [
  "risk_per_trade_pct", "max_open_positions", "max_margin_fraction",
  "timeframe", "max_leverage", "min_score", "atr_stop_multiple",
  "atr_target_multiple"
];

function response(data, status, origin) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Vary": "Origin"
  };
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "true";
  }
  return new Response(JSON.stringify(data), { status, headers });
}

function validateSettings(s) {
  if (!s || typeof s !== "object" || Array.isArray(s)) throw new Error("Invalid settings");
  const n = (k, min, max) => {
    const v = Number(s[k]);
    if (!Number.isFinite(v) || v < min || v > max) throw new Error("Invalid setting: " + k);
  };
  n("risk_per_trade_pct", 0.05, 0.5);
  n("max_open_positions", 1, 5);
  n("max_margin_fraction", 0.02, 0.2);
  n("max_leverage", 1, 3);
  n("min_score", 1, 5);
  n("atr_stop_multiple", 0.8, 3);
  n("atr_target_multiple", 1, 6);
  if (!["5m", "15m", "30m", "1h", "4h"].includes(s.timeframe)) throw new Error("Invalid timeframe");
  return Object.fromEntries(KEYS.map(k => [k, s[k]]));
}

function validateSuggestion(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Invalid suggestion");
  const s = {};
  for (const k of KEYS) s[k] = raw[k];
  const clean = validateSettings(s);
  if (clean.atr_target_multiple < clean.atr_stop_multiple) {
    clean.atr_target_multiple = clean.atr_stop_multiple;
  }
  return clean;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      if (!ALLOWED_ORIGINS.has(origin)) return new Response(null, { status: 403 });
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Credentials": "true",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "600",
          "Vary": "Origin"
        }
      });
    }

    if (!ALLOWED_ORIGINS.has(origin)) return response({ error: "Origin not allowed" }, 403, null);
    if (url.pathname !== "/api/advice") return response({ error: "Not found" }, 404, origin);
    if (request.method !== "POST") return response({ error: "Method not allowed" }, 405, origin);
    if (!env.GEMINI_API_KEY) return response({ error: "Server API key is not configured" }, 503, origin);

    let body;
    try { body = await request.json(); }
    catch { return response({ error: "Invalid JSON body" }, 400, origin); }

    const prompt = typeof body.prompt === "string" ? body.prompt.trim().slice(0, 3000) : "";
    if (!prompt) return response({ error: "A prompt is required" }, 400, origin);
    if (prompt.length < 2) return response({ error: "Prompt is too short" }, 400, origin);

    let settings;
    try { settings = validateSettings(body.settings); }
    catch (e) { return response({ error: e.message }, 400, origin); }

    const systemInstruction = `
You are TradebottenAnna's conservative strategy adviser for a rule-based crypto demo trader.
Give suggestions only. You cannot trade, access exchange credentials, or change settings.
Never promise profit. Return JSON with exactly these fields:
advice (a short Swedish explanation) and proposed_settings (an object with all eight setting fields).
Allowed bounds: risk_per_trade_pct 0.05-0.5; max_open_positions 1-5;
max_margin_fraction 0.02-0.20; timeframe 5m,15m,30m,1h,4h;
max_leverage 1-3; min_score 1-5; atr_stop_multiple 0.8-3;
atr_target_multiple 1-6 and at least atr_stop_multiple.
Prefer cautious settings. Human approval is required.
`.trim();

    try {
      const upstream = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": env.GEMINI_API_KEY
          },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemInstruction }] },
            contents: [{
              role: "user",
              parts: [{ text: JSON.stringify({ question: prompt, current_settings: settings }) }]
            }],
            generationConfig: { responseMimeType: "application/json", temperature: 0.2 }
          })
        }
      );

      if (!upstream.ok) {
        console.error("Gemini upstream status:", upstream.status);
        return response({ error: "Gemini request failed. Check server logs and API quota." }, 502, origin);
      }

      const data = await upstream.json();
      const text = data.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("");
      if (!text) return response({ error: "Gemini returned no content" }, 502, origin);

      let parsed;
      try { parsed = JSON.parse(text); }
      catch { return response({ error: "Gemini returned invalid JSON" }, 502, origin); }

      const suggestion = validateSuggestion(parsed.proposed_settings);
      const advice = typeof parsed.advice === "string" ? parsed.advice.slice(0, 1200) : "Granska förslaget innan användning.";
      return response({
        ok: true,
        advice,
        suggestion,
        requires_human_approval: true
      }, 200, origin);
    } catch (error) {
      console.error("Advice endpoint error:", error?.message || "unknown");
      return response({ error: "Unable to generate advice" }, 500, origin);
    }
  }
};
