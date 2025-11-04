// netlify/functions/charge-additional-materials.js
// Charge customer for additional materials after job completion
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
      task_id,
      material_costs,
      travel_fee = 80,
      material_receipts = [],
      handyman_notes,
      customer_approved = false
    } = JSON.parse(event.body || "{}");

    if (!task_id || !material_costs) {
      return {
        statusCode: 400,
        headers: cors(),
        body: JSON.stringify({ error: "Task ID and material costs are required" })
      };
    }

    console.log(`💰 Processing additional material charge for task: ${task_id}`);
    console.log(`📦 Material costs: $${material_costs}, Travel fee: $${travel_fee}`);

    // Get task details and original payment information
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

    // Get the original payment to find customer and payment method
    const { data: originalPayment, error: paymentError } = await supabase
      .from('payments')
      .select('*')
      .eq('task_id', task.id)
      .eq('status', 'completed')
      .single();

    if (paymentError || !originalPayment) {
      console.error('❌ Original payment not found:', paymentError);
      return {
        statusCode: 404,
        headers: cors(),
        body: JSON.stringify({ error: "Original payment not found" })
      };
    }

    // Calculate total additional cost
    const totalAdditionalCost = parseFloat(material_costs) + parseFloat(travel_fee);
    const amountInCents = Math.round(totalAdditionalCost * 100);

    // Find the original payment intent to get customer and payment method
    const originalPaymentIntent = await stripe.paymentIntents.retrieve(originalPayment.payment_intent_id);

    if (!originalPaymentIntent.customer || !originalPaymentIntent.payment_method) {
      console.error('❌ No customer or payment method found on original payment');
      return {
        statusCode: 400,
        headers: cors(),
        body: JSON.stringify({ error: "Unable to charge: no saved payment method found" })
      };
    }

    console.log(`💳 Creating additional charge for customer: ${originalPaymentIntent.customer}`);

    // Create new payment intent for additional materials
    const additionalPaymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      customer: originalPaymentIntent.customer,
      payment_method: originalPaymentIntent.payment_method,
      confirm: true,
      description: `Additional materials for task ${task.task_id}`,
      metadata: {
        original_task_id: task_id,
        original_payment_intent: originalPayment.payment_intent_id,
        charge_type: 'additional_materials',
        travel_fee: travel_fee,
        material_costs: material_costs,
        handyman_notes: handyman_notes || '',
        customer_approved: customer_approved.toString()
      }
    });

    console.log(`✅ Additional payment created: ${additionalPaymentIntent.id} - $${totalAdditionalCost}`);

    // Record the additional payment in database
    const { error: additionalPaymentError } = await supabase
      .from('payments')
      .insert({
        task_id: task.id,
        amount: totalAdditionalCost,
        payment_intent_id: additionalPaymentIntent.id,
        status: 'completed',
        payment_type: 'additional_materials',
        travel_fee: travel_fee,
        material_costs: material_costs,
        material_receipts: material_receipts,
        handyman_notes: handyman_notes,
        customer_approved: customer_approved,
        captured_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (additionalPaymentError) {
      console.error('❌ Failed to record additional payment:', additionalPaymentError);
      // Don't fail the request since payment was successful
    }

    // Update task with additional payment information
    const { error: taskUpdateError } = await supabase
      .from('tasks')
      .update({
        additional_materials_cost: totalAdditionalCost,
        additional_payment_intent_id: additionalPaymentIntent.id,
        total_amount: task.total_amount + totalAdditionalCost,
        updated_at: new Date().toISOString()
      })
      .eq('id', task_id);

    if (taskUpdateError) {
      console.error('❌ Failed to update task with additional costs:', taskUpdateError);
    }

    // Send notification to customer about additional charge
    await sendAdditionalChargeNotification(task, totalAdditionalCost, material_costs, travel_fee, material_receipts);

    return {
      statusCode: 200,
      headers: cors(),
      body: JSON.stringify({
        success: true,
        payment_intent_id: additionalPaymentIntent.id,
        additional_amount: totalAdditionalCost,
        travel_fee: travel_fee,
        material_costs: material_costs,
        message: "Additional materials charged successfully",
        task_id: task_id
      })
    };

  } catch (error) {
    console.error('❌ Additional materials charge error:', error);
    return {
      statusCode: 500,
      headers: cors(),
      body: JSON.stringify({
        error: 'Additional materials charge failed',
        detail: error.message
      })
    };
  }
};

// Send notification to customer about additional charge
async function sendAdditionalChargeNotification(task, totalAmount, materialCosts, travelFee, receipts) {
  try {
    console.log(`📧 Sending additional charge notification for task ${task.id}`);

    // Send SMS notification
    try {
      const smsResponse = await fetch('/.netlify/functions/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'additional_charge',
          data: {
            customer_phone: task.customer_phone,
            task_id: task.task_id,
            additional_amount: totalAmount,
            travel_fee: travelFee,
            material_costs: materialCosts,
            service_name: task.task_category,
            customer_name: task.customer_name
          }
        })
      });

      if (smsResponse.ok) {
        console.log('✅ SMS additional charge notification sent successfully');
      } else {
        console.error('❌ SMS notification failed:', await smsResponse.text());
      }
    } catch (smsError) {
      console.error('❌ SMS notification error:', smsError);
    }

    // Send email notification with receipts
    try {
      const emailResponse = await fetch('/.netlify/functions/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'additional_charge',
          customer: {
            name: task.customer_name,
            email: task.customer_email,
            phone: task.customer_phone,
            address: task.customer_address
          },
          task: {
            id: task.task_id,
            category: task.task_category,
            description: task.task_description
          },
          additional_charge: {
            total_amount: totalAmount,
            travel_fee: travelFee,
            material_costs: materialCosts,
            receipts: receipts
          }
        })
      });

      if (emailResponse.ok) {
        console.log('✅ Email additional charge notification sent successfully');
      } else {
        console.error('❌ Email notification failed:', await emailResponse.text());
      }
    } catch (emailError) {
      console.error('❌ Email notification error:', emailError);
    }

  } catch (error) {
    console.error('❌ Error sending additional charge notifications:', error);
  }
}

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };
}