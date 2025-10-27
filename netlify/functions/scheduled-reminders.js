// netlify/functions/scheduled-reminders.js
// Automated pre-arrival notifications for SendAHandyman bookings
// Runs every 15 minutes via Netlify scheduled function

import { createClient } from '@supabase/supabase-js';
import { schedule } from '@netlify/functions';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

const reminderHandler = async (event, context) => {
  console.log('🔄 Scheduled reminders function started at:', new Date().toISOString());

  try {
    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get current time and calculate thresholds
    const now = new Date();
    const twoHoursFromNow = new Date(now.getTime() + (2 * 60 * 60 * 1000));
    const thirtyMinutesFromNow = new Date(now.getTime() + (30 * 60 * 1000));
    const fifteenMinutesFromNow = new Date(now.getTime() + (15 * 60 * 1000));

    console.log('⏰ Time windows:', {
      now: now.toISOString(),
      twoHours: twoHoursFromNow.toISOString(),
      thirtyMin: thirtyMinutesFromNow.toISOString(),
      fifteenMin: fifteenMinutesFromNow.toISOString()
    });

    // 🔔 STEP 1: Process 2-hour handyman reminders
    const handymanReminders = await process2HourHandymanReminders(supabase, now, twoHoursFromNow);

    // 🔔 STEP 2: Process 30-minute client notifications
    const clientNotifications = await process30MinuteClientNotifications(supabase, now, thirtyMinutesFromNow);

    const summary = {
      timestamp: now.toISOString(),
      handyman_reminders_sent: handymanReminders.sent,
      handyman_reminders_failed: handymanReminders.failed,
      client_notifications_sent: clientNotifications.sent,
      client_notifications_failed: clientNotifications.failed,
      total_processed: handymanReminders.sent + clientNotifications.sent
    };

    console.log('✅ Scheduled reminders completed:', summary);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        success: true,
        summary: summary
      })
    };

  } catch (error) {
    console.error('❌ Scheduled reminders failed:', error);

    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};

// 🔔 Process 2-hour handyman reminders
async function process2HourHandymanReminders(supabase, now, twoHoursFromNow) {
  console.log('🔧 Processing 2-hour handyman reminders...');

  let sent = 0;
  let failed = 0;

  try {
    // Query tasks needing 2-hour reminders
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select(`
        id,
        task_category,
        scheduled_datetime,
        customer_address,
        assigned_handyman_phone,
        assigned_handyman_name,
        reminder_2hr_sent
      `)
      .in('status', ['pending', 'confirmed'])
      .eq('reminder_2hr_sent', false)
      .gte('scheduled_datetime', now.toISOString())
      .lte('scheduled_datetime', twoHoursFromNow.toISOString())
      .not('assigned_handyman_phone', 'is', null);

    if (error) {
      throw new Error(`Supabase query failed: ${error.message}`);
    }

    console.log(`📋 Found ${tasks?.length || 0} tasks needing 2-hour handyman reminders`);

    if (tasks && tasks.length > 0) {
      for (const task of tasks) {
        try {
          const scheduledTime = new Date(task.scheduled_datetime);
          const timeString = scheduledTime.toLocaleTimeString('en-US', {
            hour: '1-digit',
            minute: '2-digit',
            hour12: true
          });

          const message = `Reminder: You have a job starting at ${timeString} at ${task.customer_address}. Task: ${task.task_category}`;

          // Send SMS to handyman
          const smsResult = await sendSMS(task.assigned_handyman_phone, message);

          if (smsResult.success) {
            // Update reminder flag
            const { error: updateError } = await supabase
              .from('tasks')
              .update({
                reminder_2hr_sent: true,
                reminder_2hr_sent_at: now.toISOString()
              })
              .eq('id', task.id);

            if (updateError) {
              console.error(`❌ Failed to update reminder flag for task ${task.id}:`, updateError);
              failed++;
            } else {
              console.log(`✅ 2-hour reminder sent to ${task.assigned_handyman_name} for task ${task.id}`);
              sent++;
            }
          } else {
            console.error(`❌ Failed to send SMS to ${task.assigned_handyman_phone}:`, smsResult.error);
            failed++;
          }

        } catch (taskError) {
          console.error(`❌ Error processing task ${task.id}:`, taskError);
          failed++;
        }
      }
    }

  } catch (error) {
    console.error('❌ Error in process2HourHandymanReminders:', error);
    failed++;
  }

  return { sent, failed };
}

// 🔔 Process 30-minute client notifications
async function process30MinuteClientNotifications(supabase, now, thirtyMinutesFromNow) {
  console.log('👤 Processing 30-minute client notifications...');

  let sent = 0;
  let failed = 0;

  try {
    // Query tasks needing 30-minute client notifications
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select(`
        id,
        task_category,
        scheduled_datetime,
        customer_phone,
        customer_email,
        customer_name,
        reminder_30min_sent
      `)
      .in('status', ['pending', 'confirmed'])
      .eq('reminder_30min_sent', false)
      .gte('scheduled_datetime', now.toISOString())
      .lte('scheduled_datetime', thirtyMinutesFromNow.toISOString());

    if (error) {
      throw new Error(`Supabase query failed: ${error.message}`);
    }

    console.log(`📋 Found ${tasks?.length || 0} tasks needing 30-minute client notifications`);

    if (tasks && tasks.length > 0) {
      for (const task of tasks) {
        try {
          const scheduledTime = new Date(task.scheduled_datetime);
          const timeString = scheduledTime.toLocaleTimeString('en-US', {
            hour: '1-digit',
            minute: '2-digit',
            hour12: true
          });

          const message = `Your handyman will arrive soon for your ${task.task_category} appointment at ${timeString}`;

          // Send SMS to client if phone number available
          if (task.customer_phone) {
            const smsResult = await sendSMS(task.customer_phone, message);

            if (!smsResult.success) {
              console.error(`❌ Failed to send SMS to ${task.customer_phone}:`, smsResult.error);
            }
          }

          // Send email notification (if email service is configured)
          // TODO: Implement email notification via SendGrid/Mailgun

          // Update reminder flag regardless of SMS success (to prevent spam)
          const { error: updateError } = await supabase
            .from('tasks')
            .update({
              reminder_30min_sent: true,
              reminder_30min_sent_at: now.toISOString()
            })
            .eq('id', task.id);

          if (updateError) {
            console.error(`❌ Failed to update 30min reminder flag for task ${task.id}:`, updateError);
            failed++;
          } else {
            console.log(`✅ 30-minute notification sent to ${task.customer_name} for task ${task.id}`);
            sent++;
          }

        } catch (taskError) {
          console.error(`❌ Error processing task ${task.id}:`, taskError);
          failed++;
        }
      }
    }

  } catch (error) {
    console.error('❌ Error in process30MinuteClientNotifications:', error);
    failed++;
  }

  return { sent, failed };
}

// 📱 Send SMS via Twilio
async function sendSMS(phoneNumber, message) {
  try {
    if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
      throw new Error('Twilio credentials not configured');
    }

    // Import Twilio (you'll need to add this to package.json)
    const twilio = require('twilio')(twilioAccountSid, twilioAuthToken);

    const result = await twilio.messages.create({
      body: message,
      from: twilioPhoneNumber,
      to: phoneNumber
    });

    console.log(`📱 SMS sent successfully to ${phoneNumber}, SID: ${result.sid}`);

    return {
      success: true,
      sid: result.sid
    };

  } catch (error) {
    console.error(`❌ SMS send failed for ${phoneNumber}:`, error);

    return {
      success: false,
      error: error.message
    };
  }
}

// Export the scheduled function
export const handler = schedule("*/15 * * * *", reminderHandler);