-- Create admin table for secure admin access management
-- Run this SQL in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS public.admin_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'admin' CHECK (role IN ('super_admin', 'admin', 'manager')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES public.admin_users(id),
    notes TEXT
);

-- Create index for faster email lookups
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON public.admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_active ON public.admin_users(is_active);

-- Enable RLS (Row Level Security)
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for admin access
CREATE POLICY "Admin users can view all admin users" ON public.admin_users
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.admin_users
            WHERE email = auth.jwt() ->> 'email'
            AND is_active = true
        )
    );

-- Create RLS policy for admin updates
CREATE POLICY "Super admins can manage admin users" ON public.admin_users
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.admin_users
            WHERE email = auth.jwt() ->> 'email'
            AND role = 'super_admin'
            AND is_active = true
        )
    );

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_admin_users_updated_at
    BEFORE UPDATE ON public.admin_users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert initial super admin (replace with your actual email)
-- You'll need to manually run this with your email address
/*
INSERT INTO public.admin_users (email, full_name, role, is_active, notes)
VALUES (
    'your_email@example.com',
    'Your Full Name',
    'super_admin',
    true,
    'Initial super admin - created during system setup'
);
*/

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON public.admin_users TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.admin_users TO service_role;

COMMENT ON TABLE public.admin_users IS 'Administrative users with access to admin portal';
COMMENT ON COLUMN public.admin_users.role IS 'Admin permission level: super_admin, admin, or manager';
COMMENT ON COLUMN public.admin_users.is_active IS 'Whether the admin user can access the system';
COMMENT ON COLUMN public.admin_users.created_by IS 'Which admin user created this account';