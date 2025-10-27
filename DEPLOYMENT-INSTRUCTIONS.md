# 🔔 Automated Pre-Arrival Notifications Deployment Instructions

## Overview
This system sends automated reminders for SendAHandyman bookings:
- **2 hours before**: SMS reminder to assigned handyman
- **30 minutes before**: SMS/Email notification to client

## Files Created/Updated

### ✅ New Files:
- `netlify/functions/scheduled-reminders.js` - Main scheduled function
- `database-schema-update.sql` - Database schema changes
- `DEPLOYMENT-INSTRUCTIONS.md` - This file

### ✅ Updated Files:
- `netlify.toml` - Added scheduled function configuration
- `package.json` - Added @supabase/supabase-js dependency

## Deployment Steps

### 1. Database Setup
Run the SQL commands in `database-schema-update.sql` on your Supabase database:

```sql
-- Add reminder tracking columns
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS reminder_2hr_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS reminder_2hr_sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS reminder_30min_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS reminder_30min_sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS assigned_handyman_phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS assigned_handyman_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS scheduled_datetime TIMESTAMP WITH TIME ZONE;
```

### 2. Environment Variables
Add these environment variables to your Netlify site settings:

```bash
# Existing (if not already set)
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# New Twilio credentials
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number_with_country_code
```

### 3. Install Dependencies
Run this command to install the new Supabase dependency:

```bash
npm install @supabase/supabase-js@^2.38.0
```

### 4. Netlify Plugin Installation
Install the scheduled functions plugin:

```bash
npm install --save-dev @netlify/plugin-scheduled-functions
```

### 5. Deploy to Netlify
Push all changes to your repository. Netlify will:
- Deploy the scheduled function
- Configure the 15-minute cron schedule
- Start automated reminder processing

## System Architecture

### Scheduled Function Flow:
```
Every 15 minutes → scheduled-reminders.js runs
    ↓
Query Supabase for upcoming tasks
    ↓
Process 2-hour handyman reminders
    ↓
Process 30-minute client notifications
    ↓
Update database flags to prevent duplicates
    ↓
Log results and exit
```

### Database Query Logic:
```sql
-- 2-hour handyman reminders
SELECT * FROM tasks
WHERE status IN ('pending', 'confirmed')
  AND reminder_2hr_sent = FALSE
  AND scheduled_datetime BETWEEN NOW() AND (NOW() + INTERVAL '2 hours')
  AND assigned_handyman_phone IS NOT NULL;

-- 30-minute client notifications
SELECT * FROM tasks
WHERE status IN ('pending', 'confirmed')
  AND reminder_30min_sent = FALSE
  AND scheduled_datetime BETWEEN NOW() AND (NOW() + INTERVAL '30 minutes');
```

## Message Templates

### Handyman 2-Hour Reminder:
```
"Reminder: You have a job starting at [TIME] at [ADDRESS]. Task: [TASK_CATEGORY]"
```

### Client 30-Minute Notification:
```
"Your handyman will arrive soon for your [TASK_CATEGORY] appointment at [TIME]"
```

## Monitoring & Logs

### View Function Logs:
1. Go to Netlify Dashboard → Site → Functions
2. Click on `scheduled-reminders`
3. View execution logs and errors

### Function Returns:
```json
{
  "success": true,
  "summary": {
    "timestamp": "2024-10-27T14:30:00Z",
    "handyman_reminders_sent": 3,
    "handyman_reminders_failed": 0,
    "client_notifications_sent": 2,
    "client_notifications_failed": 0,
    "total_processed": 5
  }
}
```

## Troubleshooting

### Common Issues:

1. **Function not running**:
   - Check netlify.toml configuration
   - Verify @netlify/plugin-scheduled-functions is installed

2. **SMS not sending**:
   - Verify Twilio credentials in environment variables
   - Check Twilio account balance and phone number verification

3. **Database connection issues**:
   - Verify Supabase URL and key
   - Check if database schema was updated correctly

4. **No tasks found**:
   - Ensure `scheduled_datetime` is populated for tasks
   - Check task status values ('pending', 'confirmed')

### Testing the Function:
You can manually trigger the function for testing:
```bash
curl -X POST https://your-site.netlify.app/.netlify/functions/scheduled-reminders
```

## Success Metrics
- ✅ Function runs every 15 minutes without errors
- ✅ Handymen receive SMS 2 hours before appointments
- ✅ Clients receive notifications 30 minutes before arrival
- ✅ No duplicate notifications sent
- ✅ Database flags updated correctly

## Next Steps
1. Monitor function execution for first week
2. Consider adding email notifications for clients
3. Add customizable message templates
4. Implement timezone handling for different regions