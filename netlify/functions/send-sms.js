const twilio = require('twilio');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { type, data } = JSON.parse(event.body);

    // Check for required Twilio credentials
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
      console.error('Missing Twilio credentials');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'SMS service not configured' })
      };
    }

    const client = twilio(accountSid, authToken);

    let message = '';
    let recipient = '';

    switch (type) {
      case 'booking_confirmation':
        recipient = data.customer_phone;
        message = `SendAHandyman Confirmation 📋
Task ID: ${data.task_id}
Service: ${data.service_name}
Time: ${data.time_window}
Total: $${data.total_amount}

Your handyman will text you 30 mins before arrival with their details. Cancel anytime before work starts.

Questions? Reply STOP to opt out.`;
        break;

      case 'technician_dispatch':
        recipient = data.tech_phone;
        message = `New Job Assignment 🔧
Task ID: ${data.task_id}
Customer: ${data.customer_name}
Phone: ${data.customer_phone}
Service: ${data.service_name}
Address: ${data.address}
Time: ${data.time_window}
Notes: ${data.notes || 'None'}

Please confirm receipt.`;
        break;

      case 'tech_enroute':
        recipient = data.customer_phone;
        message = `Your SendAHandyman is on the way! 🚐
Technician: ${data.tech_name}
Phone: ${data.tech_phone}
ETA: ${data.eta}
Task: ${data.service_name}

They'll call if they need to access the property.`;
        break;

      case 'job_complete':
        recipient = data.customer_phone;
        message = `Job Complete! ✅
Task ID: ${data.task_id}
Total Charged: $${data.final_amount}

Thanks for choosing SendAHandyman! Please leave us a review and save our number for future needs.`;
        break;

      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid SMS type' })
        };
    }

    console.log(`Sending ${type} SMS to ${recipient}`);

    const result = await client.messages.create({
      body: message,
      from: fromNumber,
      to: recipient
    });

    console.log(`SMS sent successfully: ${result.sid}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        messageSid: result.sid,
        type: type
      })
    };

  } catch (error) {
    console.error('SMS error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to send SMS notification',
        details: error.message
      })
    };
  }
};