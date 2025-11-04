// netlify/functions/admin-create-quote.js
// Create secure quote tokens for admin-generated quotes
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

export const handler = async (event, context) => {
  try {
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 200, headers: cors() };
    }
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, headers: cors(), body: JSON.stringify({ error: "Method not allowed" }) };
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const {
      customer_name,
      customer_phone,
      customer_email,
      service_type,
      amount,
      description,
      expiry_days = 14
    } = JSON.parse(event.body || "{}");

    // Validate required fields
    if (!customer_name || !customer_phone || !service_type || !amount) {
      return {
        statusCode: 400,
        headers: cors(),
        body: JSON.stringify({ error: "Missing required fields: customer_name, customer_phone, service_type, amount" })
      };
    }

    console.log(`💰 Creating admin quote for ${customer_name} - ${service_type}: $${amount}`);

    // Generate secure quote token
    const quoteToken = crypto.randomBytes(16).toString('hex');
    const quoteId = `QUOTE-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Calculate expiry date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiry_days);

    // Insert quote into database
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .insert({
        quote_id: quoteId,
        quote_token: quoteToken,
        customer_name: customer_name,
        customer_phone: customer_phone,
        customer_email: customer_email || null,
        service_type: service_type,
        custom_amount: amount,
        description: description || null,
        expires_at: expiresAt.toISOString(),
        status: 'pending',
        created_by: 'admin', // Track that this was admin-created
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (quoteError) {
      console.error('❌ Error creating quote:', quoteError);
      throw new Error(`Database error: ${quoteError.message}`);
    }

    console.log(`✅ Quote created successfully: ${quoteId} (Token: ${quoteToken})`);

    // Log admin action
    console.log(`🔐 Admin quote created - ID: ${quoteId}, Customer: ${customer_name}, Amount: $${amount}`);

    return {
      statusCode: 200,
      headers: cors(),
      body: JSON.stringify({
        success: true,
        quote_id: quoteId,
        quote_token: quoteToken,
        quote_url: `${getBaseUrl(event)}/quote/${quoteToken}`,
        expires_at: expiresAt.toISOString(),
        customer_name: customer_name,
        service_type: service_type,
        amount: amount,
        message: "Quote created successfully"
      })
    };

  } catch (error) {
    console.error('❌ Admin quote creation error:', error);
    return {
      statusCode: 500,
      headers: cors(),
      body: JSON.stringify({
        error: 'Failed to create quote',
        detail: error.message
      })
    };
  }
};

// Helper function to get base URL
function getBaseUrl(event) {
  const headers = event.headers;
  const protocol = headers['x-forwarded-proto'] || 'https';
  const host = headers.host || headers['x-forwarded-host'];
  return `${protocol}://${host}`;
}

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };
}