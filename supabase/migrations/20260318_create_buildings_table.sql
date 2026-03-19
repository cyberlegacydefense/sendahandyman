-- Create buildings table for partner property landing pages
-- Each building gets a custom landing page with QR code attribution

CREATE TABLE IF NOT EXISTS buildings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Building Identity
    building_name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,  -- URL path: /lumaire, /the-bristol

    -- Address (auto-populates checkout)
    street TEXT,
    city TEXT,
    state TEXT DEFAULT 'FL',
    zip TEXT,

    -- Branding
    logo_url TEXT,              -- Path to building logo image
    accent_color TEXT DEFAULT '#0ea5e9',  -- Hex color for CTAs

    -- Custom Content (optional)
    headline TEXT,              -- Custom hero headline
    subheadline TEXT,           -- Custom subheadline
    featured_services TEXT[],   -- Array of service keys to show (null = show all)

    -- Property Manager Contact (optional)
    pm_name TEXT,
    pm_email TEXT,
    pm_phone TEXT,

    -- Status
    active BOOLEAN DEFAULT true,  -- false = show "Coming Soon"

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_buildings_slug ON buildings(slug);
CREATE INDEX IF NOT EXISTS idx_buildings_active ON buildings(active);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_buildings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
DROP TRIGGER IF EXISTS buildings_updated_at ON buildings;
CREATE TRIGGER buildings_updated_at
    BEFORE UPDATE ON buildings
    FOR EACH ROW
    EXECUTE FUNCTION update_buildings_updated_at();

-- Enable Row Level Security
ALTER TABLE buildings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow authenticated users full access to buildings"
    ON buildings
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow public read access to active buildings"
    ON buildings
    FOR SELECT
    TO anon
    USING (active = true);

-- Grant permissions
GRANT ALL ON buildings TO authenticated;
GRANT SELECT ON buildings TO anon;

-- Insert initial Lumaire building
INSERT INTO buildings (building_name, slug, street, city, state, zip, accent_color, active)
VALUES ('Lumaire', 'lumaire', '2000 S Ocean Blvd', 'Boca Raton', 'FL', '33432', '#D4AF37', true)
ON CONFLICT (slug) DO NOTHING;

-- Insert The Bristol as coming soon example
INSERT INTO buildings (building_name, slug, street, city, state, zip, accent_color, active)
VALUES ('The Bristol', 'the-bristol', '1100 S Flagler Dr', 'West Palm Beach', 'FL', '33401', '#1e3a5f', false)
ON CONFLICT (slug) DO NOTHING;

-- Add comments
COMMENT ON TABLE buildings IS 'Partner buildings with custom landing pages and QR codes';
COMMENT ON COLUMN buildings.slug IS 'URL path segment (e.g., lumaire for /lumaire)';
COMMENT ON COLUMN buildings.accent_color IS 'Hex color for CTA buttons on landing page';
COMMENT ON COLUMN buildings.featured_services IS 'Service keys to show; null means show all services';
