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

    console.log(`💾 Payment record lookup:`, {
      payment,
      paymentError,
      taskId: task.id
    });

    // If we have a payment record with payment_intent_id, use it directly
    if (payment && payment.payment_intent_id) {
      console.log(`🎯 Found payment intent ID in database: ${payment.payment_intent_id}`);

      try {
        const existingPaymentIntent = await stripe.paymentIntents.retrieve(payment.payment_intent_id);

        if (existingPaymentIntent && existingPaymentIntent.status === 'requires_capture') {
          console.log(`✅ Using stored payment intent: ${payment.payment_intent_id}`);

          // Capture the payment using stored ID
          const capturedPayment = await stripe.paymentIntents.capture(payment.payment_intent_id, {
            metadata: {
              task_completed_at: new Date().toISOString(),
              completion_photos_count: completion_photos?.length || 0,
              completion_notes: completion_notes || 'No notes provided'
            }
          });

          console.log(`✅ Payment captured using stored ID: ${capturedPayment.id} - $${task.total_amount}`);

          // Update payment record
          await updatePaymentRecord(supabase, payment, capturedPayment, completion_photos, completion_notes);

          // Update task status
          await updateTaskStatus(supabase, task_id);

          // Send notifications
          await sendCustomerCompletionNotifications(task, capturedPayment.id, completion_photos, completion_notes);

          return {
            statusCode: 200,
            headers: cors(),
            body: JSON.stringify({
              success: true,
              payment_intent_id: capturedPayment.id,
              amount_captured: task.total_amount,
              message: "Payment captured successfully using stored payment intent ID",
              task_id: task_id
            })
          };
        }
      } catch (retrieveError) {
        console.error(`❌ Failed to retrieve stored payment intent ${payment.payment_intent_id}:`, retrieveError);
      }
    }

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

    console.log(`🔍 Searching for payment intent:`, {
      targetAmount,
      taskCustomerName: task.customer_name,
      taskCustomerEmail: task.customer_email,
      availablePaymentIntents: paymentIntents.data.map(pi => ({
        id: pi.id,
        amount: pi.amount,
        status: pi.status,
        metadata: pi.metadata
      }))
    });

    const paymentIntent = paymentIntents.data.find(pi => {
      const amountMatches = pi.amount === targetAmount;
      const statusMatches = pi.status === 'requires_capture';
      const nameMatches = pi.metadata.customer_name === task.customer_name;
      const emailMatches = pi.metadata.customer_email === task.customer_email;

      console.log(`🔍 Checking payment intent ${pi.id}:`, {
        amountMatches,
        statusMatches,
        nameMatches,
        emailMatches,
        metadata: pi.metadata
      });

      return amountMatches && statusMatches && (nameMatches || emailMatches);
    });

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

    // Update payment record and task status
    await updatePaymentRecord(supabase, payment, capturedPayment, completion_photos, completion_notes);
    await updateTaskStatus(supabase, task_id);

    // Send completion notifications to customer
    await sendCustomerCompletionNotifications(task, capturedPayment.id, completion_photos, completion_notes);

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

// Send completion notifications to customer
async function sendCustomerCompletionNotifications(task, paymentIntentId, completionPhotos, completionNotes) {
  try {
    console.log(`📧 Sending completion notifications for task ${task.id}`);

    // Send SMS notification
    try {
      const smsResponse = await fetch('/.netlify/functions/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'job_complete',
          data: {
            customer_phone: task.customer_phone,
            task_id: task.task_id,
            final_amount: task.total_amount,
            service_name: task.task_category,
            customer_name: task.customer_name
          }
        })
      });

      if (smsResponse.ok) {
        console.log('✅ SMS completion notification sent successfully');
      } else {
        console.error('❌ SMS notification failed:', await smsResponse.text());
      }
    } catch (smsError) {
      console.error('❌ SMS notification error:', smsError);
    }

    // Send email notification
    try {
      const emailResponse = await fetch('/.netlify/functions/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'task_completion',
          customer: {
            name: task.customer_name,
            email: task.customer_email,
            phone: task.customer_phone,
            address: task.customer_address
          },
          task: {
            id: task.task_id,
            category: task.task_category,
            description: task.task_description,
            completed_at: new Date().toISOString(),
            completion_notes: completionNotes || 'Task completed successfully'
          },
          handyman: {
            name: task.assigned_handyman_name,
            phone: task.assigned_handyman_phone
          },
          payment: {
            amount: task.total_amount,
            payment_intent_id: paymentIntentId,
            status: 'completed'
          },
          completion_photos: completionPhotos || []
        })
      });

      if (emailResponse.ok) {
        console.log('✅ Email completion notification sent successfully');
      } else {
        console.error('❌ Email notification failed:', await emailResponse.text());
      }
    } catch (emailError) {
      console.error('❌ Email notification error:', emailError);
    }

  } catch (error) {
    console.error('❌ Error sending completion notifications:', error);
  }
}

// Helper function to update payment record
async function updatePaymentRecord(supabase, payment, capturedPayment, completionPhotos, completionNotes) {
  const { error: paymentUpdateError } = await supabase
    .from('payments')
    .update({
      status: 'completed',
      payment_intent_id: capturedPayment.id,
      captured_at: new Date().toISOString(),
      completion_photos: completionPhotos,
      completion_notes: completionNotes,
      updated_at: new Date().toISOString()
    })
    .eq('id', payment.id);

  if (paymentUpdateError) {
    console.error('❌ Failed to update payment record:', paymentUpdateError);
    // Don't fail the whole request since payment was captured successfully
  } else {
    console.log('✅ Payment record updated successfully');
  }
}

// Helper function to update task status
async function updateTaskStatus(supabase, taskId) {
  const { error: taskUpdateError } = await supabase
    .from('tasks')
    .update({
      status: 'completed',
      payment_status: 'captured',
      payment_captured_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', taskId);

  if (taskUpdateError) {
    console.error('❌ Failed to update task payment status:', taskUpdateError);
  } else {
    console.log('✅ Task status updated successfully');
  }
}

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };
}