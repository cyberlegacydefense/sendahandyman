// netlify/functions/process-quote-payment.js
// Process payment for admin-generated quotes
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
    const {
      quote_token,
      customer_name,
      customer_phone,
      customer_email,
      customer_address,
      timing_preference,
      payment_method_id
    } = JSON.parse(event.body || "{}");

    if (!quote_token || !payment_method_id) {
      return {
        statusCode: 400,
        headers: cors(),
        body: JSON.stringify({ error: "Quote token and payment method are required" })
      };
    }

    console.log(`💰 Processing quote payment for token: ${quote_token.substring(0, 8)}...`);

    // Get quote details
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select('*')
      .eq('quote_token', quote_token)
      .single();

    if (quoteError || !quote) {
      return {
        statusCode: 404,
        headers: cors(),
        body: JSON.stringify({ error: "Quote not found" })
      };
    }

    // Verify quote is still valid
    if (quote.status !== 'pending') {
      return {
        statusCode: 400,
        headers: cors(),
        body: JSON.stringify({ error: "Quote is no longer available" })
      };
    }

    if (new Date() > new Date(quote.expires_at)) {
      return {
        statusCode: 400,
        headers: cors(),
        body: JSON.stringify({ error: "Quote has expired" })
      };
    }

    // Create payment intent with Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(quote.custom_amount * 100), // Convert to cents
      currency: 'usd',
      payment_method: payment_method_id,
      confirmation_method: 'manual',
      confirm: true,
      description: `Quote Payment: ${quote.service_type} for ${customer_name}`,
      metadata: {
        quote_id: quote.quote_id,
        quote_token: quote_token,
        customer_name: customer_name,
        service_type: quote.service_type,
        source: 'admin_quote'
      }
    });

    if (paymentIntent.status === 'requires_action') {
      return {
        statusCode: 200,
        headers: cors(),
        body: JSON.stringify({
          requires_action: true,
          payment_intent: {
            id: paymentIntent.id,
            client_secret: paymentIntent.client_secret
          }
        })
      };
    } else if (paymentIntent.status !== 'succeeded') {
      throw new Error('Payment failed');
    }

    console.log(`✅ Payment successful: ${paymentIntent.id} - $${quote.custom_amount}`);

    // Update quote status
    const { error: quoteUpdateError } = await supabase
      .from('quotes')
      .update({
        status: 'paid',
        payment_intent_id: paymentIntent.id,
        used_at: new Date().toISOString(),
        final_customer_name: customer_name,
        final_customer_phone: customer_phone,
        final_customer_email: customer_email,
        final_customer_address: customer_address,
        timing_preference: timing_preference
      })
      .eq('quote_token', quote_token);

    if (quoteUpdateError) {
      console.error('❌ Failed to update quote status:', quoteUpdateError);
    }

    // Create task record for the paid quote
    const taskId = `TASK-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .insert({
        task_id: taskId,
        customer_name: customer_name,
        customer_phone: customer_phone,
        customer_email: customer_email,
        customer_address: customer_address,
        task_category: quote.service_type,
        task_description: quote.description || quote.service_type,
        time_window: timing_preference || 'flexible',
        status: 'pending',
        payment_status: 'authorized',
        total_amount: quote.custom_amount,
        source: 'admin_quote',
        quote_id: quote.quote_id,
        scheduled_date: new Date().toISOString().split('T')[0],
        notes: `Created from admin quote ${quote.quote_id}`
      })
      .select()
      .single();

    if (taskError) {
      console.error('❌ Failed to create task:', taskError);
    }

    // Create payment record
    const { error: paymentError } = await supabase
      .from('payments')
      .insert({
        task_id: task?.id,
        amount: quote.custom_amount,
        payment_intent_id: paymentIntent.id,
        status: 'completed',
        payment_type: 'quote_payment',
        quote_id: quote.quote_id,
        created_at: new Date().toISOString()
      });

    if (paymentError) {
      console.error('❌ Failed to create payment record:', paymentError);
    }

    // Send notifications
    await sendQuoteBookingNotifications(quote, task, customer_name, customer_phone, customer_email);

    return {
      statusCode: 200,
      headers: cors(),
      body: JSON.stringify({
        success: true,
        payment_intent_id: paymentIntent.id,
        task_id: taskId,
        amount: quote.custom_amount,
        service: quote.service_type,
        message: "Payment successful! Your handyman service has been booked."
      })
    };

  } catch (error) {
    console.error('❌ Quote payment processing error:', error);
    return {
      statusCode: 500,
      headers: cors(),
      body: JSON.stringify({
        error: 'Payment processing failed',
        detail: error.message
      })
    };
  }
};

// Send booking notifications
async function sendQuoteBookingNotifications(quote, task, customerName, customerPhone, customerEmail) {
  try {
    console.log(`📧 Sending quote booking notifications for ${quote.quote_id}`);

    // Send SMS notification to customer
    try {
      const smsResponse = await fetch('/.netlify/functions/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'quote_booking_confirmation',
          data: {
            customer_phone: customerPhone,
            customer_name: customerName,
            service_name: quote.service_type,
            amount: quote.custom_amount,
            task_id: task?.task_id
          }
        })
      });

      if (smsResponse.ok) {
        console.log('✅ SMS booking confirmation sent');
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
          type: 'quote_booking',
          customer: {
            name: customerName,
            email: customerEmail,
            phone: customerPhone
          },
          quote: {
            id: quote.quote_id,
            service_type: quote.service_type,
            amount: quote.custom_amount,
            description: quote.description
          },
          task: {
            id: task?.task_id,
            created_at: new Date().toISOString()
          }
        })
      });

      if (emailResponse.ok) {
        console.log('✅ Email booking confirmation sent');
      }
    } catch (emailError) {
      console.error('❌ Email notification error:', emailError);
    }

  } catch (error) {
    console.error('❌ Error sending quote booking notifications:', error);
  }
}

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };
}