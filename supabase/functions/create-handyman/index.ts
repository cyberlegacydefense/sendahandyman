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

    const requestBody = await req.json();
    console.log("Request body received:", requestBody);

    const { name, email, phone } = requestBody;

    if (!name || !email) {
      console.error("Missing required fields:", { name: !!name, email: !!email });
      throw new Error("Name and email required");
    }

    console.log("Validating email:", email);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.error("Email regex validation failed for:", email);
      throw new Error("Invalid email format");
    }
    console.log("Email validation passed");

    // Check for existing email before proceeding
    console.log("🔍 Checking for existing email in handymen table:", email.toLowerCase());
    const { data: existingCheck, error: checkError } = await supabaseAdmin
      .from("handymen")
      .select("id, email, full_name")
      .eq("email", email.toLowerCase())
      .maybeSingle();

    if (checkError) {
      console.error("🚨 Error checking for existing email:", checkError);
    } else if (existingCheck) {
      console.log("🚨 Found existing handyman with this email:", existingCheck);
      throw new Error(`Email ${email.toLowerCase()} already exists in handymen table`);
    } else {
      console.log("✅ No existing handyman found with this email, proceeding...");
    }

    const adjectives = ["Quick", "Smart", "Brave", "Swift", "Bright"];
    const nouns = ["Tiger", "Eagle", "Wolf", "Lion", "Bear"];
    const numbers = Math.floor(100 + Math.random() * 900);
    const tempPassword = adjectives[Math.floor(Math.random() * adjectives.length)] +
                        nouns[Math.floor(Math.random() * nouns.length)] +
                        numbers;

    console.log("Creating auth user with email:", email.toLowerCase());
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase(),
      password: tempPassword,
      email_confirm: false, // Create unconfirmed first
      user_metadata: {
        full_name: name,
        user_type: "handyman"
      },
      app_metadata: {
        user_type: "handyman",
        created_by_admin: true
      }
    });

    if (authError) {
      console.error("Auth user creation failed:", authError);
      console.error("Auth error details:", JSON.stringify(authError, null, 2));
      throw new Error(`Failed to create auth user: ${authError.message}`);
    }

    console.log("Auth user created successfully, forcing email confirmation...");

    // Force email confirmation using admin API
    console.log("Manually confirming email for user:", authData.user.id);
    const { data: updatedUser, error: confirmError } = await supabaseAdmin.auth.admin.updateUserById(
      authData.user.id,
      {
        email_confirm: true,
        user_metadata: {
          ...authData.user.user_metadata,
          full_name: name,
          user_type: "handyman"
        }
      }
    );

    if (confirmError) {
      console.error("Email confirmation failed:", confirmError);
      throw new Error(`Failed to confirm email: ${confirmError.message}`);
    } else {
      console.log("Email manually confirmed successfully");
      console.log("Updated user data:", updatedUser);
    }

    console.log("Creating handyman record...");

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
    console.log("Full name field specifically:", {
      name: name,
      full_name: handymanInsertData.full_name,
      name_type: typeof name,
      name_length: name?.length
    });

    const { data: handymanData, error: handymanError } = await supabaseAdmin
      .from("handymen")
      .insert(handymanInsertData)
      .select()
      .single();

    if (handymanData) {
      console.log("Handyman record created successfully:", handymanData);
      console.log("Checking full_name in returned data:", {
        returned_full_name: handymanData.full_name,
        all_fields: Object.keys(handymanData)
      });
    }

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

      // Handle duplicate email gracefully
      if (handymanError.message?.includes('duplicate key value violates unique constraint "handymen_email_key"')) {
        console.log("Duplicate email detected, checking existing record...");

        // Check if the existing record has null full_name and fix it
        const { data: existingHandyman, error: fetchError } = await supabaseAdmin
          .from("handymen")
          .select("*")
          .eq("email", email.toLowerCase())
          .single();

        if (!fetchError && existingHandyman) {
          console.log("Found existing handyman record:", existingHandyman);

          // If full_name is null, update it
          if (!existingHandyman.full_name) {
            console.log("Updating null full_name for existing record...");
            const { error: updateError } = await supabaseAdmin
              .from("handymen")
              .update({ full_name: name })
              .eq("id", existingHandyman.id);

            if (updateError) {
              console.error("Failed to update full_name:", updateError);
            } else {
              console.log("Successfully updated full_name");
              existingHandyman.full_name = name;
            }
          }

          return {
            success: true,
            handyman: {
              id: existingHandyman.id,
              name: existingHandyman.full_name || name,
              email: existingHandyman.email,
              auth_user_id: existingHandyman.user_id
            },
            message: "Handyman already exists, updated missing information"
          };
        }

        console.log(`Duplicate key error but no record found for ${email.toLowerCase()}, possibly due to timing/race condition`);
        console.log("This suggests a transient issue - record may have been created and deleted");
        throw new Error(`Transient duplicate key error for ${email.toLowerCase()}. Please try again or contact admin.`);
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
    console.error("🚨 EDGE FUNCTION ERROR:", error);
    console.error("🔍 Error type:", typeof error);
    console.error("🔍 Error name:", error.name);
    console.error("🔍 Error message:", error.message);
    console.error("🔍 Error stack:", error.stack);
    console.error("🔍 Full error object:", JSON.stringify(error, Object.getOwnPropertyNames(error)));

    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      errorType: error.name,
      details: error.toString(),
      timestamp: new Date().toISOString(),
      debugInfo: {
        stack: error.stack,
        props: Object.getOwnPropertyNames(error)
      }
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      },
      status: 400
    });
  }
});