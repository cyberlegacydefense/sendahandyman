// netlify/functions/create-task.js
// Create task record in Supabase database
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const handler = async (event, context) => {
  try {
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 200, headers: cors() };
    }
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, headers: cors(), body: JSON.stringify({ error: "Method not allowed" }) };
    }

    // Create Supabase client with RLS bypass if using service role key
    const supabaseOptions = {};
    if (supabaseKey === process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.log('🔐 Using service role key - RLS should be bypassed automatically');
    }

    const supabase = createClient(supabaseUrl, supabaseKey, supabaseOptions);
    const taskData = JSON.parse(event.body || "{}");

    console.log('🔧 Creating task in database:', taskData.task_id);
    console.log('🔑 Using Supabase SERVICE ROLE key (bypasses RLS)');

    // 🚨 DEBUG: Check if environment variables are actually set
    console.log('🔍 Environment Debug:', {
      hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      hasUrl: !!process.env.SUPABASE_URL,
      serviceRoleKeyLength: process.env.SUPABASE_SERVICE_ROLE_KEY?.length || 0,
      urlLength: process.env.SUPABASE_URL?.length || 0,
      keyStartsWith: supabaseKey?.substring(0, 20) + '...'
    });

    // Prepare task data for insertion
    const taskInsertData = {
      task_id: taskData.task_id,
      customer_name: taskData.name,
      customer_phone: taskData.phone,
      customer_email: taskData.email,
      customer_address: taskData.address || taskData.property_address,
      task_category: taskData.category,
      task_description: taskData.description || '',
      scheduled_date: new Date().toISOString().split('T')[0], // Today's date for now
      time_window: taskData.window,
      estimated_hours: taskData.estimated_hours,
      status: 'pending',
      total_amount: taskData.total_amount,
      notes: `Access: ${taskData.access_details || 'N/A'} | Pets: ${taskData.pets_and_special || 'N/A'} | Additional: ${taskData.additional_details || 'N/A'}`,
      // New fields for automated reminders (will be populated when handyman is assigned)
      scheduled_datetime: null, // Will be set when appointment is scheduled
      assigned_handyman_phone: null, // Will be set when handyman is assigned
      assigned_handyman_name: null, // Will be set when handyman is assigned
      reminder_2hr_sent: false,
      reminder_2hr_sent_at: null,
      reminder_30min_sent: false,
      reminder_30min_sent_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    console.log('🔍 Task data to insert:', JSON.stringify(taskInsertData, null, 2));

    // 🔑 Using SERVICE ROLE key as configured in Netlify environment
    if (!supabaseKey || !supabaseUrl) {
      console.error('🚨 CRITICAL: Missing Netlify environment variables!');
      console.error('🔍 Missing:', {
        SUPABASE_URL: !supabaseUrl,
        SUPABASE_SERVICE_ROLE_KEY: !supabaseKey
      });
      throw new Error('Server configuration error: Missing Netlify environment variables');
    }

    // Use the existing supabase client (with SERVICE ROLE key)
    // Service role key automatically bypasses all RLS policies
    console.log('🔐 Using SERVICE ROLE key - RLS policies bypassed automatically');

    // Insert task into database using SERVICE ROLE key
    // Service role key bypasses all RLS policies - no authentication needed
    console.log('🔄 Attempting task insert with SERVICE ROLE key...');

    const { data: task, error } = await supabase
      .from('tasks')
      .insert([taskInsertData])
      .select()
      .single();

    if (error) {
      console.error('❌ Database insert failed:', error);
      console.error('🔍 Full error details:', JSON.stringify(error, null, 2));
      console.error('🔑 Service Role Debug:', {
        errorCode: error.code,
        errorDetails: error.details,
        errorHint: error.hint,
        isRLSError: error.message?.includes('row-level security'),
        keyType: 'SERVICE_ROLE',
        note: 'Service role should bypass RLS - this may be a different error'
      });
      throw new Error(`Database insert failed: ${error.message}`);
    }

    console.log('✅ Task created successfully:', task.id);

    // Also create payment record using SERVICE ROLE key client
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert([
        {
          task_id: task.id,
          amount: taskData.total_amount,
          status: 'pending', // Will be updated when payment is captured
          hold_reason: 'Authorization hold - awaiting service completion',
          hold_until: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString() // 48 hours from now
        }
      ]);

    if (paymentError) {
      console.error('❌ Payment record creation failed:', paymentError);
      // Don't fail the whole request, just log it
    }

    return {
      statusCode: 200,
      headers: cors(),
      body: JSON.stringify({
        success: true,
        task_id: task.id,
        task_number: task.task_id,
        message: "Task created successfully"
      })
    };

  } catch (error) {
    console.error('❌ Create task error:', error);
    return {
      statusCode: 500,
      headers: cors(),
      body: JSON.stringify({
        error: 'Task creation failed',
        detail: error.message
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