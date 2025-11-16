import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders
    });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const { data: adminUser, error: adminError } = await supabaseAdmin
      .from("admin_users")
      .select("id, role")
      .eq("id", user.id)
      .eq("is_active", true)
      .single();

    if (adminError || !adminUser) {
      throw new Error("Access denied");
    }

    const { name, email, phone } = await req.json();

    if (!name || !email) {
      throw new Error("Name and email required");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error("Invalid email format");
    }

    // Check if email already exists (more detailed check)
    const { data: existing, error: existingError } = await supabaseAdmin
      .from("handymen")
      .select("id, email, full_name")
      .eq("email", email.toLowerCase())
      .maybeSingle();

    console.log("Existing handyman check:", { existing, existingError, searchEmail: email.toLowerCase() });

    if (existing) {
      console.error(`Email conflict: ${email} already exists for handyman ${existing.full_name} (ID: ${existing.id})`);
      throw new Error(`Email already exists: ${email} is registered to ${existing.full_name}`);
    }

    if (existingError && existingError.code !== 'PGRST116') {
      console.error("Database check error:", existingError);
      throw new Error("Database verification failed");
    }

    const adjectives = ["Quick", "Smart", "Brave", "Swift", "Bright"];
    const nouns = ["Tiger", "Eagle", "Wolf", "Lion", "Bear"];
    const numbers = Math.floor(100 + Math.random() * 900);
    const tempPassword = adjectives[Math.floor(Math.random() * adjectives.length)] +
                        nouns[Math.floor(Math.random() * nouns.length)] +
                        numbers;

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase(),
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: name,
        user_type: "handyman"
      }
    });

    if (authError) {
      console.error("Auth user creation failed:", authError);
      throw new Error(`Failed to create auth user: ${authError.message}`);
    }

    console.log("Auth user created successfully, creating handyman record...");

    // Double-check for race condition before inserting
    const { data: raceCheck } = await supabaseAdmin
      .from("handymen")
      .select("id, email, full_name")
      .eq("email", email.toLowerCase())
      .maybeSingle();

    if (raceCheck) {
      console.error("Race condition detected - email was just taken:", raceCheck);
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw new Error(`Email was just taken by ${raceCheck.full_name}. Please try a different email.`);
    }

    const handymanInsertData = {
      user_id: authData.user.id,
      email: email.toLowerCase(),
      full_name: name,
      phone: phone || null,
      hourly_rate: 64.00,
      onboarding_completed: false,
      is_active: true
    };

    console.log("Inserting handyman data:", handymanInsertData);

    const { data: handymanData, error: handymanError } = await supabaseAdmin
      .from("handymen")
      .insert(handymanInsertData)
      .select()
      .single();

    if (handymanError) {
      console.error("Handyman creation failed:", handymanError);
      console.error("Error details:", {
        code: handymanError.code,
        message: handymanError.message,
        details: handymanError.details,
        hint: handymanError.hint
      });

      // Clean up auth user
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);

      // Provide specific error messages
      if (handymanError.message?.includes('duplicate key value violates unique constraint "handymen_email_key"')) {
        throw new Error(`Failed to create handyman record: Email ${email.toLowerCase()} already exists in the database`);
      } else if (handymanError.message?.includes('unique constraint')) {
        throw new Error(`Failed to create handyman record: ${handymanError.message}`);
      } else {
        throw new Error(`Failed to create handyman record: ${handymanError.message}`);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      handyman: {
        id: handymanData.id,
        name: handymanData.full_name,
        email: handymanData.email,
        auth_user_id: authData.user.id
      },
      credentials: {
        email: email.toLowerCase(),
        password: tempPassword
      }
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      },
      status: 200
    });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      },
      status: 400
    });
  }
});