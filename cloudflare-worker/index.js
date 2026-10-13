
const ALLOWED_ORIGINS = new Set([
  "https://therog1.github.io",
]);

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...headers },
  });
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");

    // Health check: works when opening the Worker URL directly.
    if (request.method === "GET" && url.pathname === "/") {
      return json({
        service: "TradebottenAnna API",
        status: "online",
        adviceEndpoint: "/api/gemini-advice",
        tradingEnabled: false,
      });
    }

    // Only the configured website may call the API from a browser.
    if (!origin || !ALLOWED_ORIGINS.has(origin)) {
      return json({ error: "Origin not allowed" }, 403);
    }

    const headers = corsHeaders(origin);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }

    if (
      request.method !== "POST" ||
      !["/api/gemini-advice", "/api/advice"].includes(url.pathname)
    ) {
      return json({ error: "Not found" }, 404, headers);
    }

    if (!env.GEMINI_API_KEY) {
      return json(
        { error: "Server configuration missing GEMINI_API_KEY" },
        500,
        headers,
      );
    }

    let body;
    try {
      const contentLength = Number(
        request.headers.get("Content-Length") || 0,
      );

      if (contentLength > 20000) {
        return json({ error: "Request too large" }, 413, headers);
      }

      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON request" }, 400, headers);
    }

    const settings = body.settings ?? body;
    const userQuestion = String(
      body.question ?? body.prompt ?? body.message ?? "",
    ).slice(0, 3000);

    const safeSettings = {
      risk_per_trade_pct: settings.risk_per_trade_pct,
      max_open_positions: settings.max_open_positions,
      max_margin_fraction: settings.max_margin_fraction,
      timeframe: settings.timeframe,
      max_leverage: settings.max_leverage,
      min_score: settings.min_score,
      atr_stop_multiple: settings.atr_stop_multiple,
      atr_target_multiple: settings.atr_target_multiple,
      symbols: Array.isArray(settings.symbols)
        ? settings.symbols.slice(0, 20)
        : undefined,
    };

    const prompt = `
Du är TradebottenAnnas försiktiga strategirådgivare.
Systemet är en regelbaserad kryptobot som endast ska användas
för analys och OKX EU DEMO.

Analysera inställningarna och föreslå försiktiga värden.
Påstå inte att någon strategi är garanterat lönsam.
Hitta inte på marknadsdata eller backtestresultat.
Ändra inte inställningar automatiskt och lägg aldrig order.

Aktuella inställningar:
${JSON.stringify(safeSettings, null, 2)}

Användarens fråga:
${userQuestion || "Granska inställningarna och föreslå försiktiga förbättringar."}

Svara på svenska. Returnera giltig JSON med följande struktur:
{
  "summary": "Kort sammanfattning",
  "risk_notes": ["Risk eller begränsning"],
  "suggested_settings": {
    "risk_per_trade_pct": null,
    "max_open_positions": null,
    "max_margin_fraction": null,
    "timeframe": null,
    "max_leverage": null,
    "min_score": null,
    "atr_stop_multiple": null,
    "atr_target_multiple": null
  },
  "reasoning": ["Motivering"],
  "requires_human_approval": true
}

Ange bara föreslagna värden när du kan motivera dem.
Använd null för värden du inte kan bedöma.
`;

    try {
      const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": env.GEMINI_API_KEY,
          },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [{ text: prompt }],
              },
            ],
            generationConfig: {
              temperature: 0.2,
              responseMimeType: "application/json",
            },
          }),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        console.error("Gemini request failed:", response.status);
        return json(
          {
            error: "Gemini request failed",
            status: response.status,
          },
          502,
          headers,
        );
      }

      const adviceText =
        result.candidates?.[0]?.content?.parts
          ?.map((part) => part.text || "")
          .join("") || "";

      if (!adviceText) {
        return json(
          { error: "Gemini returned no advice" },
          502,
          headers,
        );
      }

      let advice;
      try {
        advice = JSON.parse(adviceText);
      } catch {
        advice = {
          summary: adviceText,
          requires_human_approval: true,
        };
      }

      return json(
        {
          success: true,
          advice,
          tradingEnabled: false,
        },
        200,
        headers,
      );
    } catch (error) {
      console.error("Advice request failed:", error?.message);
      return json(
        { error: "Unable to contact Gemini" },
        502,
        headers,
      );
    }
  },
};
