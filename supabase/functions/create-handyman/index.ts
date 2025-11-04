import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Verify the user is authenticated (session-based security)
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - please log in again' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Verify user has admin access
    const { data: adminUser, error: adminError } = await supabaseAdmin
      .from('admin_users')
      .select('id, role')
      .eq('id', user.id)
      .eq('is_active', true)
      .single()

    if (adminError || !adminUser) {
      return new Response(
        JSON.stringify({ error: 'Access denied - admin privileges required' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Parse request body
    const { name, email, phone } = await req.json()

    // Validate required fields
    if (!name || !email) {
      return new Response(
        JSON.stringify({ error: 'Name and email are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Please enter a valid email address' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log(`🔐 Admin ${adminUser.role} creating handyman: ${email}`)

    // Check if email already exists in handymen table
    const { data: existingHandyman, error: checkError } = await supabaseAdmin
      .from('handymen')
      .select('id, email')
      .eq('email', email.toLowerCase())
      .maybeSingle()

    if (existingHandyman) {
      return new Response(
        JSON.stringify({
          error: 'Email already exists',
          details: `A handyman with email "${email}" already exists in the system`
        }),
        {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Generate secure temporary password
    const tempPassword = generateSecurePassword()

    // Create Supabase Auth user
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase(),
      password: tempPassword,
      email_confirm: true, // Skip email verification for admin-created accounts
      user_metadata: {
        full_name: name,
        user_type: 'handyman',
        created_by_admin: true
      }
    })

    if (authError) {
      console.error('❌ Auth creation failed:', authError)
      return new Response(
        JSON.stringify({
          error: 'Failed to create authentication account',
          details: authError.message
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('✅ Auth user created:', authUser.user.id)

    // Create handyman record
    const handymanData = {
      user_id: authUser.user.id,
      email: email.toLowerCase(),
      full_name: name,
      phone: phone || null,
      hourly_rate: 64.00,
      onboarding_completed: false,
      is_active: true
    }

    const { data: handyman, error: handymanError } = await supabaseAdmin
      .from('handymen')
      .insert(handymanData)
      .select()
      .single()

    if (handymanError) {
      console.error('❌ Handyman creation failed:', handymanError)

      // Clean up auth user if handyman creation fails
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id)

      return new Response(
        JSON.stringify({
          error: 'Failed to create handyman record',
          details: handymanError.message
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('✅ Handyman created successfully:', handyman.id)

    return new Response(
      JSON.stringify({
        success: true,
        handyman: {
          id: handyman.id,
          name: handyman.full_name,
          email: handyman.email,
          auth_user_id: authUser.user.id
        },
        credentials: {
          email: email.toLowerCase(),
          password: tempPassword
        },
        message: 'Handyman created successfully'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('❌ Error in create-handyman function:', error)
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

// Generate a secure temporary password
function generateSecurePassword(): string {
  const adjectives = ['Quick', 'Smart', 'Brave', 'Swift', 'Bright', 'Strong', 'Fast', 'Bold']
  const nouns = ['Tiger', 'Eagle', 'Wolf', 'Lion', 'Bear', 'Hawk', 'Fox', 'Shark']
  const numbers = Math.floor(100 + Math.random() * 900) // 3-digit number

  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)]
  const noun = nouns[Math.floor(Math.random() * nouns.length)]

  return `${adjective}${noun}${numbers}`
}