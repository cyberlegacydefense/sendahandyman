// netlify/functions/classify-task.js
// LLM-powered service category classification for text descriptions

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

const CATEGORIES = [
  { key: 'tv-mounting', name: 'TV Wall Mount', examples: 'mount TV, hang television, wall mount flat screen' },
  { key: 'ceiling-fan', name: 'Ceiling Fan Install/Replace', examples: 'ceiling fan, install fan, replace fan, fan wobbling, fan not working' },
  { key: 'electrical', name: 'Light Fixture / Electrical', examples: 'light fixture, chandelier, outlet, switch, wiring, ceiling light' },
  { key: 'light-plumbing', name: 'Faucet / Plumbing', examples: 'faucet, toilet, sink, leak, drain, shower head, garbage disposal, dripping' },
  { key: 'smart-doorbell', name: 'Smart Doorbell Install', examples: 'doorbell, Ring doorbell, Nest doorbell' },
  { key: 'blinds', name: 'Curtain Rods / Blinds', examples: 'blinds, curtains, shades, drapes, window coverings' },
  { key: 'floating-shelf', name: 'Floating Shelf / Wall Install', examples: 'shelf, shelves, floating shelf, wall mount, towel rack, mirror' },
  { key: 'appliance-hookup', name: 'Appliance Hookup', examples: 'washer, dryer, dishwasher, appliance, refrigerator, stove' },
  { key: 'furniture-assembly', name: 'Furniture Assembly', examples: 'assemble furniture, IKEA, bed frame, dresser, desk, bookshelf, table' },
  { key: 'closet-organizer', name: 'Closet Organizer Install', examples: 'closet, organizer, storage system' },
  { key: 'painting', name: 'Painting / Touch-up', examples: 'paint, touch up, wall color, repaint room' },
  { key: 'premium-moveout', name: 'Premium Move-out Repairs', examples: 'move out, security deposit, apartment repair, move-out' },
  { key: 'general-repair', name: 'General Repairs', examples: 'repair, fix, broken, door, window, drywall, hole, patch, damage, handyman' }
];

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const { description } = JSON.parse(event.body);

    if (!description || description.trim().length < 3) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Description required" })
      };
    }

    if (!process.env.CLAUDE_API_KEY) {
      console.warn('⚠️ CLAUDE_API_KEY not found — skipping LLM classification');
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ category: null, confidence: 'none', source: 'fallback' })
      };
    }

    const categoryList = CATEGORIES.map(c => `- "${c.key}": ${c.name} (e.g. ${c.examples})`).join('\n');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 100,
        messages: [
          {
            role: 'user',
            content: `Classify this home service request into exactly one category.

CATEGORIES:
${categoryList}

REQUEST: "${description.trim()}"

Respond with ONLY a JSON object, no other text:
{"category": "<exact key from list>", "confidence": "high|medium|low"}`
          }
        ]
      })
    });

    if (!response.ok) {
      console.error('Claude API error:', response.status);
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ category: null, confidence: 'none', source: 'fallback' })
      };
    }

    const result = await response.json();
    const text = result.content?.[0]?.text || '';

    // Parse JSON from response
    const jsonMatch = text.match(/\{[^}]+\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const validKey = CATEGORIES.find(c => c.key === parsed.category);

      if (validKey) {
        console.log(`✅ LLM classified "${description.substring(0, 50)}..." → ${parsed.category} (${parsed.confidence})`);
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            category: parsed.category,
            confidence: parsed.confidence || 'medium',
            source: 'llm'
          })
        };
      }
    }

    // Couldn't parse valid category
    console.warn('⚠️ LLM returned unparseable response:', text);
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ category: null, confidence: 'none', source: 'fallback' })
    };

  } catch (error) {
    console.error('❌ Classification error:', error);
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ category: null, confidence: 'none', source: 'fallback' })
    };
  }
};
