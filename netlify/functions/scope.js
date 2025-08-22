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

    const { category, description, base_rate_hr, hours_base, window: timeWindow, rush, name, phone, email, address } = JSON.parse(event.body || "{}");
    const rate = Number(base_rate_hr) || 80;
    const hrs  = Number(hours_base) || 1.5;

    if (!process.env.OPENAI_API_KEY) {
      console.error("Missing OPENAI_API_KEY");
      return { statusCode: 500, headers: cors(), body: JSON.stringify({ error: "Missing OPENAI_API_KEY" }) };
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const system = `You are an AI handyman assistant. Return JSON with:
- customer_scope: array of customer-friendly steps (what we'll do for you)
- handyman_scope: array of detailed technical steps for the installer
- customer_risk_flags: array of customer-friendly potential issues
- handyman_risk_flags: array of technical risks and requirements for installer
- tools_and_parts: array of items the tech should bring
- estimated_duration_hours: number
- suggested_price_usd: number (base math only: rate * hours; do NOT include surge/premiums)

Customer messages should be reassuring and benefit-focused ("We'll securely mount your TV...").
Handyman messages should be technical and actionable ("Use stud finder, bring 1/4" lag bolts...").`;

    const user = `Task category: ${category}
Client notes: ${description || "N/A"}
Customer: ${name || "N/A"} - ${phone || "N/A"} - ${email || "N/A"}
Address: ${address || "N/A"}
Base hours: ${hrs}
Base rate: ${rate}/hr
Time window: ${timeWindow}
Rush optional: ${rush ? "yes" : "no"}

Generate both customer-facing and handyman-facing messages.`;

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

    const aiResponse = JSON.parse(completion.choices?.[0]?.message?.content || "{}");
    console.log("OpenAI response received successfully");

    // Log handyman instructions to console (you can check Netlify function logs)
    console.log("=== HANDYMAN INSTRUCTIONS ===");
    console.log(`Customer: ${name} - ${phone} - ${email}`);
    console.log(`Address: ${address}`);
    console.log(`Task: ${category} - ${timeWindow}`);
    console.log(`Duration: ${aiResponse.estimated_duration_hours} hours`);
    console.log("Scope:", aiResponse.handyman_scope);
    console.log("Risk flags:", aiResponse.handyman_risk_flags);
    console.log("Tools needed:", aiResponse.tools_and_parts);
    console.log("============================");

    // Return customer-focused response
    const customerResponse = {
      step_scope: aiResponse.customer_scope || [],
      risk_flags: aiResponse.customer_risk_flags || [],
      estimated_duration_hours: aiResponse.estimated_duration_hours,
      suggested_price_usd: aiResponse.suggested_price_usd,
      // Include handyman data for now (you can remove this later)
      handyman_data: {
        scope: aiResponse.handyman_scope || [],
        risks: aiResponse.handyman_risk_flags || [],
        tools: aiResponse.tools_and_parts || []
      }
    };

    return { statusCode: 200, headers: cors(), body: JSON.stringify(customerResponse) };

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