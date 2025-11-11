// netlify/functions/admin-update-handyman.js
// Admin function to update handyman data with proper permissions
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const handler = async (event, context) => {
  try {
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 200, headers: cors() };
    }
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, headers: cors(), body: JSON.stringify({ error: "Method not allowed" }) };
    }

    // Use service role key for admin operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { handyman_id, updates } = JSON.parse(event.body || "{}");

    if (!handyman_id) {
      return {
        statusCode: 400,
        headers: cors(),
        body: JSON.stringify({ error: "Handyman ID is required" })
      };
    }

    console.log(`🔧 Admin updating handyman: ${handyman_id}`, updates);

    // Verify the admin user from the Authorization header
    const authHeader = event.headers.authorization;
    if (!authHeader) {
      return {
        statusCode: 401,
        headers: cors(),
        body: JSON.stringify({ error: "Authorization required" })
      };
    }

    const token = authHeader.replace('Bearer ', '');

    // Verify the user is an admin
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      console.error('Auth error:', userError);
      return {
        statusCode: 401,
        headers: cors(),
        body: JSON.stringify({ error: "Invalid authorization" })
      };
    }

    // Check if user is admin
    const { data: adminUser, error: adminError } = await supabaseAdmin
      .from('admin_users')
      .select('role, is_active')
      .eq('id', user.id)
      .eq('is_active', true)
      .single();

    if (adminError || !adminUser) {
      console.error('Admin check error:', adminError);
      return {
        statusCode: 403,
        headers: cors(),
        body: JSON.stringify({ error: "Admin access required" })
      };
    }

    console.log(`✅ Admin verified: ${user.email} (${adminUser.role})`);

    // Update handyman using service role (bypasses RLS)
    const { data: updateResult, error: updateError } = await supabaseAdmin
      .from('handymen')
      .update(updates)
      .eq('id', handyman_id)
      .select();

    if (updateError) {
      console.error('Update error:', updateError);
      return {
        statusCode: 500,
        headers: cors(),
        body: JSON.stringify({
          error: "Failed to update handyman",
          details: updateError.message
        })
      };
    }

    console.log(`✅ Handyman updated successfully:`, updateResult);

    return {
      statusCode: 200,
      headers: cors(),
      body: JSON.stringify({
        success: true,
        data: updateResult,
        message: "Handyman updated successfully"
      })
    };

  } catch (error) {
    console.error('Handler error:', error);
    return {
      statusCode: 500,
      headers: cors(),
      body: JSON.stringify({
        error: 'Internal server error',
        details: error.message
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