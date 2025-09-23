import fetch from 'node-fetch';

export const handler = async (event, context) => {
  // Handle CORS for browser requests
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { message, conversationHistory = [] } = JSON.parse(event.body);

    if (!message) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Message is required' })
      };
    }

    // Check for API key - try both common environment variable names
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
    if (!ANTHROPIC_API_KEY) {
      console.error('ANTHROPIC_API_KEY or CLAUDE_API_KEY environment variable not set');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'API configuration error' })
      };
    }

    // SendAHandyman knowledge base
    const knowledgeBase = `
    BUSINESS INFO:
    - Company: SendAHandyman
    - Service areas: Palm Beach, Broward, Miami-Dade counties (Boca Raton, Delray Beach, Boynton Beach, Fort Lauderdale, Hollywood, Aventura, Miami, Coral Gables, Kendall)
    - Rate: $80/hour
    - Same-day premium: +15%
    - Evening premium (4-8pm): +10%
    - Rush service: +10%
    - Contact: info@sendahandyman.com

    SERVICES & PRICING:
    1. TV Wall Mount (32-65"): $120 base (1.5 hrs)
       - +$25: TVs over 65"
       - +$40: Brick/concrete/fireplace mounting

    2. Ceiling Fan Install/Replace: $160 base (2.0 hrs)
       - +$50: Non fan-rated box replacement
       - +$40: Ceilings over 10ft

    3. Light Fixture/Chandelier: $80 base (1.0 hr)
       - +$40: Chandeliers over 25lbs
       - +$30: Ceilings over 10ft

    4. Faucet/Showerhead Replace: $80 base (1.0 hr)
       - +$40: Corroded plumbing
       - +$30: Sink/vanity removal needed

    5. Smart Doorbell Install: $60 base (0.75 hr)
       - +$30: No existing wiring
       - +$40: Chime/transformer replacement

    6. Curtain Rods/Blinds: $80 base (1.0 hr)
       - +$20: Each extra rod/blind beyond 2
       - +$40: Brick/tile/concrete mounting

    7. Floating Shelf Install: $80 base (1.0 hr)
       - +$20: Each extra shelf beyond 2
       - +$30: Heavy-duty shelves (25+ lbs)

    8. Appliance Hookup: $120 base (1.5 hrs)
       - +$40: Old appliance removal
       - +$30: New vent/supply line needed

    9. Furniture Assembly: $120 base (1.5 hrs)
       - +$30: Large/complex pieces
       - +$20: Each extra small item

    10. Closet Organizer: $160 base (2.0 hrs)
        - +$50: Custom cutting required
        - +$40: Masonry/non-standard walls

    POLICIES:
    - Payment authorized at booking, charged after work confirmed
    - Cancel anytime before work starts - no charge
    - Customer supplies all fixtures, hardware, materials
    - Tech gets approval for any scope changes
    - Background-checked, insured professionals
    - Same-day and next-day windows available

    WHAT WE DON'T DO:
    - Major electrical work (rewiring, new circuits)
    - Plumbing beyond simple replacements
    - Structural work
    - Roofing or exterior work
    - HVAC installation
    `;

    // Build conversation context
    let conversationContext = knowledgeBase + "\n\nCONVERSATION HISTORY:\n";
    if (conversationHistory && Array.isArray(conversationHistory)) {
      conversationHistory.forEach(msg => {
        if (msg.role && msg.content) {
          conversationContext += `${msg.role}: ${msg.content}\n`;
        }
      });
    }
    conversationContext += `human: ${message}`;

    console.log('Making request to Claude API with model: claude-3-haiku-20240307');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 400,
        messages: [{
          role: 'user',
          content: `You are a helpful customer service chatbot for SendAHandyman, a handyman service company. Using the knowledge base provided, answer the customer's question accurately and helpfully.

Guidelines:
- Be friendly and professional
- Provide specific pricing when relevant
- Mention service areas when location questions arise
- Encourage booking when appropriate
- If the question is outside your scope, offer to connect them with info@sendahandyman.com
- Always be accurate about what services are and aren't included
- Use the exact pricing and add-on information provided

${conversationContext}

assistant:`
        }]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Claude API error:', response.status, response.statusText);
      console.error('Error details:', errorText);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'AI service temporarily unavailable. Please try again or contact us directly at info@sendahandyman.com'
        })
      };
    }

    const result = await response.json();
    const botReply = result.content && result.content[0] && result.content[0].text
      ? result.content[0].text
      : 'I apologize, but I\'m having trouble processing your request right now.';

    console.log('Claude API response received successfully');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        reply: botReply,
        conversationId: Date.now().toString()
      })
    };

  } catch (error) {
    console.error('Chatbot error:', error);
    console.error('Error stack:', error.stack);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Sorry, I encountered an error. Please try again or contact us directly at info@sendahandyman.com',
        fallback: true
      })
    };
  }
};