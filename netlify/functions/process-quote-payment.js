// netlify/functions/process-quote-payment.js
// Process payment for admin-generated quotes
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

export const handler = async (event, context) => {
  console.log('🚀 Quote payment function started');
  console.log('📝 Environment check:', {
    hasStripeKey: !!process.env.STRIPE_SECRET_KEY,
    hasSupabaseUrl: !!process.env.SUPABASE_URL,
    hasSupabaseKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY || !!process.env.SUPABASE_ANON_KEY,
    method: event.httpMethod
  });

  try {
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 200, headers: cors() };
    }
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, headers: cors(), body: JSON.stringify({ error: "Method not allowed" }) };
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    let requestData;
    try {
      requestData = JSON.parse(event.body || "{}");
      console.log('📦 Request data received:', {
        hasQuoteToken: !!requestData.quote_token,
        hasPaymentMethodId: !!requestData.payment_method_id,
        hasCustomerData: !!(requestData.customer_name && requestData.customer_email)
      });
    } catch (parseError) {
      console.error('❌ JSON parsing error:', parseError);
      return {
        statusCode: 400,
        headers: cors(),
        body: JSON.stringify({ error: "Invalid request data" })
      };
    }

    const {
      quote_token,
      customer_name,
      customer_phone,
      customer_email,
      customer_address,
      timing_preference,
      payment_method_id
    } = requestData;

    if (!quote_token || !payment_method_id) {
      console.error('❌ Missing required fields:', { quote_token: !!quote_token, payment_method_id: !!payment_method_id });
      return {
        statusCode: 400,
        headers: cors(),
        body: JSON.stringify({ error: "Quote token and payment method are required" })
      };
    }

    console.log(`💰 Processing quote payment for token: ${quote_token.substring(0, 8)}...`);

    // Get quote details
    console.log('🔍 Looking up quote...');
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select('*')
      .eq('quote_token', quote_token)
      .single();

    if (quoteError) {
      console.error('❌ Quote lookup error:', quoteError);
      return {
        statusCode: 404,
        headers: cors(),
        body: JSON.stringify({ error: "Quote not found", details: quoteError.message })
      };
    }

    if (!quote) {
      console.error('❌ Quote not found for token:', quote_token.substring(0, 8));
      return {
        statusCode: 404,
        headers: cors(),
        body: JSON.stringify({ error: "Quote not found" })
      };
    }

    console.log('✅ Quote found:', {
      id: quote.quote_id,
      status: quote.status,
      amount: quote.custom_amount,
      service: quote.service_type
    });

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
    console.log('💳 Creating Stripe payment intent...');

    const paymentIntentData = {
      amount: Math.round(quote.custom_amount * 100), // Convert to cents
      currency: 'usd',
      payment_method: payment_method_id,
      confirmation_method: 'manual',
      confirm: true,
      return_url: `${event.headers.origin || 'https://sendahandyman.com'}/quote-payment-success?token=${quote_token}`,
      description: `Quote Payment: ${quote.service_type} for ${customer_name}`,
      metadata: {
        quote_id: quote.quote_id,
        quote_token: quote_token,
        customer_name: customer_name,
        service_type: quote.service_type,
        source: 'admin_quote'
      }
    };

    console.log('💳 Payment intent data:', {
      amount: paymentIntentData.amount,
      currency: paymentIntentData.currency,
      hasPaymentMethod: !!payment_method_id
    });

    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.create(paymentIntentData);
      console.log('✅ Payment intent created:', {
        id: paymentIntent.id,
        status: paymentIntent.status
      });
    } catch (stripeError) {
      console.error('❌ Stripe payment intent error:', stripeError);
      return {
        statusCode: 400,
        headers: cors(),
        body: JSON.stringify({
          error: 'Payment processing failed',
          details: stripeError.message
        })
      };
    }

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
    console.log('📝 Creating task record...');
    const taskId = `TASK-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const taskData = {
      task_id: taskId,
      customer_name: customer_name,
      customer_phone: customer_phone,
      customer_email: customer_email,
      customer_address: customer_address,
      task_category: quote.service_type,
      task_description: quote.description || quote.service_type,
      time_window: timing_preference || 'flexible',
      status: 'pending',
      payment_status: 'completed',
      total_amount: quote.custom_amount,
      source: 'admin_quote',
      quote_id: quote.quote_id,
      scheduled_date: new Date().toISOString().split('T')[0],
      notes: `Created from admin quote ${quote.quote_id}`
    };

    console.log('📝 Task data:', {
      task_id: taskData.task_id,
      customer_name: taskData.customer_name,
      task_category: taskData.task_category,
      total_amount: taskData.total_amount,
      payment_status: taskData.payment_status,
      status: taskData.status,
      source: taskData.source
    });

    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .insert(taskData)
      .select()
      .single();

    if (taskError) {
      console.error('❌ Failed to create task:', taskError);
      console.error('Task error details:', {
        message: taskError.message,
        code: taskError.code,
        details: taskError.details,
        hint: taskError.hint
      });
      // Don't throw error here, continue with other operations
    } else {
      console.log('✅ Task created successfully:', {
        id: task?.id,
        task_id: task?.task_id,
        customer_name: task?.customer_name,
        status: task?.status,
        payment_status: task?.payment_status
      });

      // Force admin task refresh if possible
      try {
        await fetch(`${process.env.SITE_URL || 'https://sendahandyman.com'}/.netlify/functions/refresh-admin-cache`, {
          method: 'POST',
          body: JSON.stringify({ action: 'refresh_tasks' })
        });
        console.log('📡 Admin cache refresh requested');
      } catch (refreshError) {
        console.log('⚠️  Admin refresh not available:', refreshError.message);
      }
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