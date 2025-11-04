// netlify/functions/admin-create-handyman.js
// Admin function to create new handyman with auth account
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

    // Use service role for admin operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const {
      email,
      password,
      full_name,
      phone,
      city,
      skills
    } = JSON.parse(event.body || "{}");

    // Validate required fields
    if (!email || !password || !full_name) {
      return {
        statusCode: 400,
        headers: cors(),
        body: JSON.stringify({ error: "Email, password, and full name are required" })
      };
    }

    console.log(`🔐 Admin creating handyman: ${email}`);

    // Step 1: Create Supabase Auth user using service role
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // Skip email confirmation
      user_metadata: {
        full_name: full_name,
        user_type: 'handyman'
      }
    });

    if (authError) {
      console.error('❌ Auth creation failed:', authError);
      return {
        statusCode: 400,
        headers: cors(),
        body: JSON.stringify({
          error: "Failed to create auth user",
          details: authError.message
        })
      };
    }

    console.log('✅ Auth user created:', authUser.user.id);

    // Step 2: Create handyman record
    const handymanData = {
      user_id: authUser.user.id,
      email: email,
      full_name: full_name,
      phone: phone || null,
      city: city || null,
      hourly_rate: 64.00,
      onboarding_completed: false,
      is_active: true
    };

    // Process skills if provided
    if (skills && skills.trim()) {
      handymanData.skills = skills.split(',').map(skill =>
        skill.trim().toLowerCase().replace(/\s+/g, '-')
      );
    }

    const { data: handyman, error: handymanError } = await supabase
      .from('handymen')
      .insert(handymanData)
      .select()
      .single();

    if (handymanError) {
      console.error('❌ Handyman creation failed:', handymanError);

      // Clean up auth user if handyman creation fails
      await supabase.auth.admin.deleteUser(authUser.user.id);

      return {
        statusCode: 400,
        headers: cors(),
        body: JSON.stringify({
          error: "Failed to create handyman record",
          details: handymanError.message
        })
      };
    }

    console.log('✅ Handyman created:', handyman.id);

    return {
      statusCode: 201,
      headers: cors(),
      body: JSON.stringify({
        success: true,
        auth_user_id: authUser.user.id,
        handyman_id: handyman.id,
        message: "Handyman created successfully"
      })
    };

  } catch (error) {
    console.error('❌ Error in admin-create-handyman:', error);
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