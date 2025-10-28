/**
 * Netlify Serverless Function: Expert Advice Proxy
 *
 * This function securely proxies requests to Claude API
 * keeping your API key server-side (never exposed to browser)
 *
 * Environment variable needed: CLAUDE_API_KEY
 */

exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // CORS headers for your domain
  const headers = {
    'Access-Control-Allow-Origin': '*', // Change to your domain in production
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // Parse request body
    const { question, handymanProfile, category } = JSON.parse(event.body);

    // Validate request
    if (!question) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Question is required' })
      };
    }

    // Get API key from environment variable
    const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;

    if (!CLAUDE_API_KEY) {
      console.error('CLAUDE_API_KEY not configured');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'API key not configured' })
      };
    }

    // Build system prompt with context
    const systemPrompt = buildSystemPrompt(handymanProfile);

    // Call Claude API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: question
        }]
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Claude API Error:', error);
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({
          error: error.error?.message || 'Failed to get advice from Claude API'
        })
      };
    }

    const data = await response.json();
    const advice = data.content[0].text;

    // Return successful response
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        advice: advice,
        category: category,
        usage: {
          input_tokens: data.usage?.input_tokens,
          output_tokens: data.usage?.output_tokens
        }
      })
    };

  } catch (error) {
    console.error('Function Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message
      })
    };
  }
};

/**
 * Build system prompt with handyman context
 */
function buildSystemPrompt(profile) {
  const basePrompt = `You are an expert handyman business consultant with 20+ years of experience helping independent contractors grow their businesses. You provide practical, actionable advice in a friendly, conversational tone.

Keep responses:
- Under 250 words
- Action-oriented with specific steps
- Encouraging but realistic
- Focused on what can be done this week`;

  if (!profile) return basePrompt;

  const contextPrompt = `

The handyman you're advising has this profile:
- Name: ${profile.full_name || 'Not provided'}
- Hourly Rate: $${profile.hourly_rate || '65'}
- Experience: ${profile.years_experience || 'Not specified'} years
- Service Area: ${profile.city || 'South Florida'}, ${profile.zip || ''}
- Skills: ${profile.skills?.join(', ') || 'General handyman services'}
- Average Rating: ${profile.average_rating || 'New handyman'}
- Total Jobs: ${profile.total_jobs || '0'}
- Completed Jobs: ${profile.completed_jobs || '0'}

Tailor your advice to their specific situation, experience level, and location.`;

  return basePrompt + contextPrompt;
}