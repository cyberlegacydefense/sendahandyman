// netlify/functions/capture-payment.js
// Capture authorized payment when task is completed
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
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
    const { task_id, completion_photos, completion_notes } = JSON.parse(event.body || "{}");

    if (!task_id) {
      return {
        statusCode: 400,
        headers: cors(),
        body: JSON.stringify({ error: "Task ID is required" })
      };
    }

    console.log(`💰 Processing payment capture for task: ${task_id}`);

    // Get task details and payment intent ID
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', task_id)
      .single();

    if (taskError || !task) {
      console.error('❌ Task not found:', taskError);
      return {
        statusCode: 404,
        headers: cors(),
        body: JSON.stringify({ error: "Task not found" })
      };
    }

    // Get the payment record to find the payment intent ID
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('*')
      .eq('task_id', task.id)
      .eq('status', 'pending')
      .single();

    if (paymentError || !payment) {
      console.error('❌ Payment record not found:', paymentError);
      return {
        statusCode: 404,
        headers: cors(),
        body: JSON.stringify({ error: "Payment record not found or already processed" })
      };
    }

    // Get payment intent from Stripe to find the ID
    // We need to search for payment intents by amount and metadata
    const paymentIntents = await stripe.paymentIntents.list({
      limit: 100
    });

    // Find the payment intent for this task by matching amount and customer info
    const targetAmount = Math.round(task.total_amount * 100); // Convert to cents
    const paymentIntent = paymentIntents.data.find(pi =>
      pi.amount === targetAmount &&
      pi.status === 'requires_capture' &&
      (pi.metadata.customer_name === task.customer_name ||
       pi.metadata.customer_email === task.customer_email)
    );

    if (!paymentIntent) {
      console.error('❌ No capturable payment intent found for task');
      return {
        statusCode: 404,
        headers: cors(),
        body: JSON.stringify({
          error: "No authorized payment found for this task. Payment may have expired."
        })
      };
    }

    console.log(`🔍 Found payment intent: ${paymentIntent.id} (${paymentIntent.status})`);

    // Capture the payment
    const capturedPayment = await stripe.paymentIntents.capture(paymentIntent.id, {
      amount_to_capture: targetAmount,
      metadata: {
        task_completed_at: new Date().toISOString(),
        completion_photos_count: completion_photos?.length || 0,
        completion_notes: completion_notes || 'No notes provided'
      }
    });

    console.log(`✅ Payment captured: ${capturedPayment.id} - $${task.total_amount}`);

    // Update payment record in database
    const { error: paymentUpdateError } = await supabase
      .from('payments')
      .update({
        status: 'completed',
        payment_intent_id: capturedPayment.id,
        captured_at: new Date().toISOString(),
        completion_photos: completion_photos,
        completion_notes: completion_notes,
        updated_at: new Date().toISOString()
      })
      .eq('id', payment.id);

    if (paymentUpdateError) {
      console.error('❌ Failed to update payment record:', paymentUpdateError);
      // Don't fail the whole request since payment was captured successfully
    }

    // Update task with payment confirmation
    const { error: taskUpdateError } = await supabase
      .from('tasks')
      .update({
        status: 'completed',
        payment_status: 'captured',
        payment_captured_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', task_id);

    if (taskUpdateError) {
      console.error('❌ Failed to update task payment status:', taskUpdateError);
    }

    // TODO: Send notification to customer about completed work
    // TODO: Send SMS confirmation to customer
    // TODO: Update handyman earnings

    return {
      statusCode: 200,
      headers: cors(),
      body: JSON.stringify({
        success: true,
        payment_intent_id: capturedPayment.id,
        amount_captured: task.total_amount,
        message: "Payment captured successfully",
        task_id: task_id
      })
    };

  } catch (error) {
    console.error('❌ Payment capture error:', error);
    return {
      statusCode: 500,
      headers: cors(),
      body: JSON.stringify({
        error: 'Payment capture failed',
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