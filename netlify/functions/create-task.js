// netlify/functions/create-task.js
// Create task record in Supabase database
import { createClient } from '@supabase/supabase-js';

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

    // Create Supabase client with RLS bypass if using service role key
    const supabaseOptions = {};
    if (supabaseKey === process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.log('🔐 Using service role key - RLS should be bypassed automatically');
    }

    const supabase = createClient(supabaseUrl, supabaseKey, supabaseOptions);
    const taskData = JSON.parse(event.body || "{}");

    console.log('🔧 Creating task in database:', taskData.task_id);
    console.log('🔑 Using Supabase key type:', supabaseKey === process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SERVICE_ROLE' : 'ANON');

    // 🚨 DEBUG: Check if environment variables are actually set
    console.log('🔍 Environment Debug:', {
      hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      hasAnonKey: !!process.env.SUPABASE_ANON_KEY,
      hasUrl: !!process.env.SUPABASE_URL,
      serviceRoleLength: process.env.SUPABASE_SERVICE_ROLE_KEY?.length || 0,
      keyUsedLength: supabaseKey?.length || 0,
      keyStartsWith: supabaseKey?.substring(0, 10) + '...'
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

    // 🚨 TEMPORARY WORKAROUND: Force use service role key if not already
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) {
      console.error('🚨 CRITICAL: SUPABASE_SERVICE_ROLE_KEY environment variable not set!');
      throw new Error('Server configuration error: Missing service role key');
    }

    // Create new supabase client with explicitly forced service role key
    const adminSupabase = createClient(supabaseUrl, serviceRoleKey);
    console.log('🔐 Using explicit service role client for RLS bypass');

    // Insert task into database using service role client
    const { data: task, error } = await adminSupabase
      .from('tasks')
      .insert([taskInsertData])
      .select()
      .single();

    if (error) {
      console.error('❌ Database insert failed:', error);
      console.error('🔍 Full error details:', JSON.stringify(error, null, 2));
      console.error('🔑 RLS Policy Debug:', {
        errorCode: error.code,
        errorDetails: error.details,
        errorHint: error.hint,
        isRLSError: error.message?.includes('row-level security'),
        keyType: supabaseKey === process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SERVICE_ROLE' : 'ANON'
      });
      throw new Error(`Database insert failed: ${error.message}`);
    }

    console.log('✅ Task created successfully:', task.id);

    // Also create payment record using service role client
    const { data: payment, error: paymentError } = await adminSupabase
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