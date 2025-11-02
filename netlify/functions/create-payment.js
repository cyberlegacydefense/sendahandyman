// netlify/functions/create-payment.js
import Stripe from 'stripe';

export const handler = async (event, context) => {
  try {
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 200, headers: cors() };
    }
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, headers: cors(), body: JSON.stringify({ error: "Method not allowed" }) };
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    const { amount, currency = 'usd', customer_info, job_details } = JSON.parse(event.body || "{}");

    if (!amount || amount < 50) { // Minimum $0.50
      return {
        statusCode: 400,
        headers: cors(),
        body: JSON.stringify({ error: "Invalid amount" })
      };
    }

    // Create payment intent with AUTHORIZATION HOLD (manual capture)
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency,
      capture_method: 'manual', // 🔐 AUTHORIZATION HOLD - funds held but not captured
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        customer_name: customer_info?.name || 'Unknown',
        customer_email: customer_info?.email || 'Unknown',
        customer_phone: customer_info?.phone || 'Unknown',
        service_category: job_details?.category || 'Unknown',
        service_window: job_details?.window || 'Unknown',
        estimated_hours: job_details?.hours || 'Unknown'
      },
      description: `Handyman Service: ${job_details?.category || 'Service'} - ${customer_info?.name || 'Customer'}`
    });

    console.log(`Payment intent created: ${paymentIntent.id} for $${amount}`);
    console.log('🔍 Payment Intent Creation Debug:', {
      id: paymentIntent.id,
      status: paymentIntent.status,
      capture_method: paymentIntent.capture_method,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      automatic_payment_methods: paymentIntent.automatic_payment_methods
    });

    // 🚨 CRITICAL: Verify capture method is actually manual
    if (paymentIntent.capture_method !== 'manual') {
      console.error('🚨 ERROR: Payment intent capture method is not manual!', paymentIntent.capture_method);
    } else {
      console.log('✅ CONFIRMED: Payment intent created with manual capture method');
    }

    return {
      statusCode: 200,
      headers: cors(),
      body: JSON.stringify({
        client_secret: paymentIntent.client_secret,
        payment_intent_id: paymentIntent.id,
        capture_method: paymentIntent.capture_method,
        status: paymentIntent.status
      })
    };

  } catch (error) {
    console.error('Stripe error:', error);
    return {
      statusCode: 500,
      headers: cors(),
      body: JSON.stringify({
        error: 'Payment setup failed',
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