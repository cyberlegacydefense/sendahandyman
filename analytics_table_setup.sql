-- Analytics Events Table for SendAHandyman
-- Run this in your Supabase SQL editor to create the analytics table

CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_name VARCHAR(100) NOT NULL,
  session_id VARCHAR(100),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  page_url TEXT,
  user_type VARCHAR(20) DEFAULT 'customer',

  -- Event-specific data stored as JSON
  search_query TEXT,
  service_type VARCHAR(100),
  service_display TEXT,
  funnel_step INTEGER,
  has_description BOOLEAN,
  has_photos BOOLEAN,
  has_location BOOLEAN,
  description_length INTEGER,
  ai_analysis_success BOOLEAN,
  analysis_category VARCHAR(100),
  analysis_confidence DECIMAL,
  available_slots INTEGER,
  selected_time VARCHAR(100),
  pricing DECIMAL,
  amount DECIMAL,
  payment_intent VARCHAR(100),
  time_slot VARCHAR(100),
  conversion BOOLEAN DEFAULT FALSE,
  error_type VARCHAR(100),
  error_message TEXT,

  -- Admin-specific fields
  section VARCHAR(50),
  action VARCHAR(50),
  task_id VARCHAR(100),
  quote_id VARCHAR(100),
  handyman_id VARCHAR(100),

  -- Metadata
  page_title TEXT,
  referrer TEXT,
  user_agent TEXT,
  screen_resolution VARCHAR(20),
  is_mobile BOOLEAN,

  -- Indexes
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_analytics_event_name ON analytics_events(event_name);
CREATE INDEX IF NOT EXISTS idx_analytics_timestamp ON analytics_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_analytics_session ON analytics_events(session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_funnel ON analytics_events(funnel_step) WHERE funnel_step IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_analytics_conversion ON analytics_events(conversion) WHERE conversion = true;
CREATE INDEX IF NOT EXISTS idx_analytics_user_type ON analytics_events(user_type);

-- Enable Row Level Security (optional)
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows reading/writing analytics data
-- Adjust this policy based on your security requirements
CREATE POLICY "Allow analytics data access" ON analytics_events
  FOR ALL USING (true);

-- Grant permissions (adjust based on your setup)
GRANT ALL ON analytics_events TO authenticated;
GRANT ALL ON analytics_events TO anon;

-- Sample queries you can use to analyze the data:

-- 1. Booking funnel analysis
-- SELECT
--   funnel_step,
--   COUNT(*) as sessions,
--   COUNT(DISTINCT session_id) as unique_sessions
-- FROM analytics_events
-- WHERE funnel_step IS NOT NULL
-- GROUP BY funnel_step
-- ORDER BY funnel_step;

-- 2. Most popular services
-- SELECT
--   service_type,
--   COUNT(*) as selections
-- FROM analytics_events
-- WHERE event_name = 'service_selected'
-- GROUP BY service_type
-- ORDER BY selections DESC;

-- 3. Conversion rate
-- SELECT
--   DATE(timestamp) as date,
--   COUNT(DISTINCT session_id) as total_sessions,
--   COUNT(DISTINCT CASE WHEN conversion = true THEN session_id END) as conversions,
--   ROUND(
--     COUNT(DISTINCT CASE WHEN conversion = true THEN session_id END) * 100.0 /
--     COUNT(DISTINCT session_id), 2
--   ) as conversion_rate_percent
-- FROM analytics_events
-- GROUP BY DATE(timestamp)
-- ORDER BY date DESC;

-- 4. Admin activity
-- SELECT
--   action,
--   COUNT(*) as count
-- FROM analytics_events
-- WHERE user_type = 'admin'
-- GROUP BY action
-- ORDER BY count DESC;