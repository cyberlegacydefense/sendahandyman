-- Create clients table for customer information tracking
-- This captures user info from bookings for CRM and marketing purposes

CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Contact Information
    first_name TEXT,
    last_name TEXT,
    email TEXT,
    phone TEXT,

    -- Address (can be auto-populated from building)
    street_address TEXT,
    unit_number TEXT,
    city TEXT,
    state TEXT DEFAULT 'FL',
    zip_code TEXT,

    -- Building Attribution (links to building-specific landing pages)
    building_ref TEXT,          -- e.g., 'lumaire', 'the-bristol'
    building_name TEXT,         -- e.g., 'Lumaire'

    -- Source Tracking
    source TEXT DEFAULT 'website',  -- 'website', 'qr-code', 'referral', 'manual'
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,

    -- Engagement Metrics
    first_booking_at TIMESTAMPTZ,
    last_booking_at TIMESTAMPTZ,
    total_bookings INTEGER DEFAULT 0,
    total_spent DECIMAL(10,2) DEFAULT 0,

    -- Status
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'vip', 'blocked')),
    notes TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone);
CREATE INDEX IF NOT EXISTS idx_clients_building_ref ON clients(building_ref);
CREATE INDEX IF NOT EXISTS idx_clients_created_at ON clients(created_at DESC);

-- Create unique constraint on email (for upsert operations)
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_email_unique ON clients(email) WHERE email IS NOT NULL;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_clients_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
DROP TRIGGER IF EXISTS clients_updated_at ON clients;
CREATE TRIGGER clients_updated_at
    BEFORE UPDATE ON clients
    FOR EACH ROW
    EXECUTE FUNCTION update_clients_updated_at();

-- Enable Row Level Security
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users (admin access)
CREATE POLICY "Allow authenticated users full access to clients"
    ON clients
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Grant permissions
GRANT ALL ON clients TO authenticated;
GRANT SELECT, INSERT ON clients TO anon;

-- Add comments for documentation
COMMENT ON TABLE clients IS 'Customer information captured from bookings and building-specific landing pages';
COMMENT ON COLUMN clients.building_ref IS 'Slug of the building landing page (e.g., lumaire)';
COMMENT ON COLUMN clients.source IS 'How the client was acquired: website, qr-code, referral, manual';
