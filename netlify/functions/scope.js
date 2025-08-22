// netlify/functions/scope.js
import OpenAI from "openai";

export const handler = async (event, context) => {
  try {
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 200, headers: cors() };
    }
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, headers: cors(), body: JSON.stringify({ error: "Method not allowed" }) };
    }

    const { category, description, base_rate_hr, hours_base, window: timeWindow, rush } = JSON.parse(event.body || "{}");
    const rate = Number(base_rate_hr) || 80;
    const hrs  = Number(hours_base) || 1.5;

    if (!process.env.OPENAI_API_KEY) {
      console.error("Missing OPENAI_API_KEY");
      return { statusCode: 500, headers: cors(), body: JSON.stringify({ error: "Missing OPENAI_API_KEY" }) };
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const system = `You are an AI handyman assistant. Return JSON with:
- step_scope: array of clear steps tailored to the task
- risk_flags: array of potential risks or missing requirements
- tools_and_parts: array of items the tech should bring
- estimated_duration_hours: number
- suggested_price_usd: number (base math only: rate * hours; do NOT include surge/premiums)`;

    const user = `Task category: ${category}
Client notes: ${description || "N/A"}
Base hours: ${hrs}
Base rate: $${rate}/hr
Time window: ${timeWindow}
Rush optional: ${rush ? "yes" : "no"}

Please tailor steps and risks to this category. Keep the JSON tight.`;

    console.log("Making OpenAI request for category:", category);

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ]
    });

    const content = completion.choices?.[0]?.message?.content || "{}";
    console.log("OpenAI response received successfully");

    return { statusCode: 200, headers: cors(), body: content };

  } catch (err) {
    console.error("Function error:", err);
    return {
      statusCode: 500,
      headers: cors(),
      body: JSON.stringify({
        error: "Server error",
        detail: err.message || String(err)
      })
    };
  }
};

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };
}