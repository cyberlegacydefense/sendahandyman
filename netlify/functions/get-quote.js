// netlify/functions/get-quote.js
// Retrieve quote data by secure token for customer checkout
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

export const handler = async (event, context) => {
  try {
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 200, headers: cors() };
    }
    if (event.httpMethod !== "GET") {
      return { statusCode: 405, headers: cors(), body: JSON.stringify({ error: "Method not allowed" }) };
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Extract quote token from path parameters
    const pathSegments = event.path.split('/');
    const quoteToken = pathSegments[pathSegments.length - 1];

    if (!quoteToken || quoteToken.length < 16) {
      return {
        statusCode: 400,
        headers: cors(),
        body: JSON.stringify({ error: "Invalid quote token" })
      };
    }

    console.log(`💰 Retrieving quote for token: ${quoteToken.substring(0, 8)}...`);

    // Get quote from database
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select('*')
      .eq('quote_token', quoteToken)
      .single();

    if (quoteError || !quote) {
      console.error('❌ Quote not found:', quoteError);
      return {
        statusCode: 404,
        headers: cors(),
        body: JSON.stringify({ error: "Quote not found" })
      };
    }

    // Check if quote has expired
    const now = new Date();
    const expiresAt = new Date(quote.expires_at);

    if (now > expiresAt) {
      console.log(`⏰ Quote ${quote.quote_id} has expired`);

      // Update quote status to expired
      await supabase
        .from('quotes')
        .update({ status: 'expired' })
        .eq('quote_token', quoteToken);

      return {
        statusCode: 410,
        headers: cors(),
        body: JSON.stringify({
          error: "Quote has expired",
          expired: true,
          expires_at: quote.expires_at
        })
      };
    }

    // Check if quote has already been used/paid
    if (quote.status === 'paid') {
      return {
        statusCode: 410,
        headers: cors(),
        body: JSON.stringify({
          error: "Quote has already been used",
          already_paid: true
        })
      };
    }

    console.log(`✅ Valid quote found: ${quote.quote_id} for ${quote.customer_name}`);

    // Log quote access (for analytics)
    console.log(`📊 Quote accessed - ID: ${quote.quote_id}, Customer: ${quote.customer_name}, Amount: $${quote.custom_amount}`);

    return {
      statusCode: 200,
      headers: cors(),
      body: JSON.stringify({
        success: true,
        quote: {
          quote_id: quote.quote_id,
          customer_name: quote.customer_name,
          customer_phone: quote.customer_phone,
          customer_email: quote.customer_email,
          service_type: quote.service_type,
          amount: quote.custom_amount,
          description: quote.description,
          expires_at: quote.expires_at,
          created_at: quote.created_at,
          days_until_expiry: Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24))
        }
      })
    };

  } catch (error) {
    console.error('❌ Get quote error:', error);
    return {
      statusCode: 500,
      headers: cors(),
      body: JSON.stringify({
        error: 'Failed to retrieve quote',
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