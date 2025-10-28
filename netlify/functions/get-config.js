// netlify/functions/get-config.js
// Securely provide Supabase configuration to client

export const handler = async (event, context) => {
  try {
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 200, headers: cors() };
    }
    if (event.httpMethod !== "GET") {
      return { statusCode: 405, headers: cors(), body: JSON.stringify({ error: "Method not allowed" }) };
    }

    // Only provide config if Supabase environment variables are available
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return {
        statusCode: 404,
        headers: cors(),
        body: JSON.stringify({ error: "Configuration not available" })
      };
    }

    // Return the configuration
    return {
      statusCode: 200,
      headers: cors(),
      body: JSON.stringify({
        supabaseUrl: supabaseUrl,
        supabaseKey: supabaseKey
      })
    };

  } catch (error) {
    console.error('Config error:', error);
    return {
      statusCode: 500,
      headers: cors(),
      body: JSON.stringify({
        error: 'Configuration fetch failed',
        detail: error.message
      })
    };
  }
};

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };
}