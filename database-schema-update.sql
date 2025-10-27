-- Database Schema Update for Automated Pre-Arrival Notifications
-- Add reminder tracking columns to tasks table

ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS reminder_2hr_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS reminder_2hr_sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS reminder_30min_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS reminder_30min_sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS assigned_handyman_phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS assigned_handyman_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS scheduled_datetime TIMESTAMP WITH TIME ZONE;

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_tasks_reminder_2hr
ON tasks (status, reminder_2hr_sent, scheduled_datetime)
WHERE reminder_2hr_sent = FALSE;

CREATE INDEX IF NOT EXISTS idx_tasks_reminder_30min
ON tasks (status, reminder_30min_sent, scheduled_datetime)
WHERE reminder_30min_sent = FALSE;

-- Add comment to explain the schema
COMMENT ON COLUMN tasks.reminder_2hr_sent IS 'Track if 2-hour handyman reminder has been sent';
COMMENT ON COLUMN tasks.reminder_30min_sent IS 'Track if 30-minute client notification has been sent';
COMMENT ON COLUMN tasks.assigned_handyman_phone IS 'Phone number of assigned handyman for SMS reminders';
COMMENT ON COLUMN tasks.assigned_handyman_name IS 'Name of assigned handyman';
COMMENT ON COLUMN tasks.scheduled_datetime IS 'Exact scheduled date and time for the appointment';

-- Sample data structure after update:
/*
tasks table will include:
- id (existing)
- customer_name (existing)
- customer_phone (existing)
- customer_email (existing)
- customer_address (existing)
- task_category (existing)
- status (existing) - values: 'pending', 'confirmed', 'in_progress', 'completed'
- scheduled_datetime (new) - when the handyman should arrive
- assigned_handyman_phone (new) - for SMS reminders
- assigned_handyman_name (new) - for logging/tracking
- reminder_2hr_sent (new) - boolean flag
- reminder_2hr_sent_at (new) - timestamp when sent
- reminder_30min_sent (new) - boolean flag
- reminder_30min_sent_at (new) - timestamp when sent
*/