# Admin System Setup Guide

## 🚀 Quick Start

### 1. Create the Admin Table

Run this SQL in your **Supabase SQL Editor**:

```sql
-- Create admin table
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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON public.admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_active ON public.admin_users(is_active);

-- Enable RLS
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.admin_users TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.admin_users TO service_role;
```

### 2. Create Supabase Auth User First

In **Supabase Auth Dashboard**:
1. Go to **Authentication → Users**
2. Click **"Invite User"**
3. Enter your email address
4. Set a secure password
5. Copy the **User UUID** (looks like: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`)

### 3. Link Admin Record to Auth User

Run this SQL with **your actual auth UUID and details**:

```sql
-- Replace 'your-auth-uuid-here' with the UUID from Step 2
INSERT INTO public.admin_users (
    id,  -- IMPORTANT: Use the same UUID as the auth user
    email,
    full_name,
    role,
    is_active,
    notes
)
VALUES (
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',  -- Your actual auth UUID
    'your_email@example.com',
    'Your Full Name',
    'super_admin',
    true,
    'Linked to Supabase Auth user'
);
```

### Alternative: Auto-Link Method

If you create the admin record without the UUID first:

```sql
-- Create admin record without UUID
INSERT INTO public.admin_users (email, full_name, role, is_active, notes)
VALUES (
    'your_email@example.com',
    'Your Full Name',
    'super_admin',
    true,
    'Will be auto-linked on first login'
);
```

The system will automatically link the auth UUID on your first successful login.

### 4. Create Quotes Table (if not exists)

```sql
CREATE TABLE IF NOT EXISTS public.quotes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    quote_id VARCHAR(255) NOT NULL UNIQUE,
    quote_token VARCHAR(255) NOT NULL UNIQUE,
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(255) NOT NULL,
    customer_email VARCHAR(255),
    service_type VARCHAR(255) NOT NULL,
    custom_amount DECIMAL(10,2) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'expired', 'cancelled')),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_by VARCHAR(255) DEFAULT 'admin',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    used_at TIMESTAMP WITH TIME ZONE,
    payment_intent_id VARCHAR(255),
    final_customer_name VARCHAR(255),
    final_customer_phone VARCHAR(255),
    final_customer_email VARCHAR(255),
    final_customer_address TEXT,
    timing_preference VARCHAR(255)
);

-- Create indexes for quotes
CREATE INDEX IF NOT EXISTS idx_quotes_token ON public.quotes(quote_token);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON public.quotes(status);
CREATE INDEX IF NOT EXISTS idx_quotes_expires ON public.quotes(expires_at);

-- Enable RLS for quotes
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

-- Grant permissions for quotes
GRANT SELECT, INSERT, UPDATE ON public.quotes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.quotes TO service_role;
```

## 🔐 How to Access Admin Portal

### For Handymen (to see Admin button):
1. Log into handyman dashboard
2. If your email is in `admin_users` table → Admin button appears
3. Click Admin button → Opens admin portal in new tab

### Direct Admin Access:
1. Go to `yoursite.com/admin.html`
2. Login with your admin email/password
3. Access all admin features

## 📋 Admin Features

### ✅ **What's Working Now:**
- **Secure Authentication**: Database-driven admin access control
- **Quote Generation**: Create secure quote links for phone customers
- **Handyman Management**: View all handymen and their status
- **Analytics Dashboard**: Revenue metrics and system health
- **Role-based Access**: super_admin, admin, manager roles

### 🎯 **Quote Workflow:**
1. **Phone Call** → Customer describes need
2. **Admin Creates Quote** → Set service, price, customer details
3. **Send Quote Link** → Copy and send via SMS/email
4. **Customer Pays** → Secure checkout, task created automatically
5. **Track Conversion** → Monitor quote performance

### 📊 **Admin Roles:**
- **super_admin**: Full system access, can manage other admins
- **admin**: Standard admin access, quote creation, handyman management
- **manager**: Limited access, view-only analytics

## 🛠️ Next Steps

### Optional Enhancements:
1. **SMS Integration**: Auto-send quote links via SMS
2. **Email Templates**: Branded quote email templates
3. **Advanced Analytics**: Conversion tracking, performance reports
4. **Mobile Admin App**: Native mobile admin interface

### Security Best Practices:
1. Use strong passwords for admin accounts
2. Regularly review admin_users table
3. Monitor admin access logs
4. Set quote expiration appropriately (7-14 days)

## 🚨 Troubleshooting

### Admin Button Not Showing:
1. Check your email is in `admin_users` table
2. Ensure `is_active = true`
3. Check browser console for errors

### Quote Links Not Working:
1. Verify `quotes` table exists
2. Check Netlify functions are deployed
3. Ensure Stripe keys are configured

### Authentication Issues:
1. Verify Supabase auth user exists
2. Check email matches exactly (case-sensitive)
3. Ensure RLS policies are applied correctly

## 📞 Support

For technical issues:
1. Check browser console for errors
2. Review Netlify function logs
3. Verify Supabase table permissions
4. Test with sample data first

---

**🎉 You're all set!** Your admin system is now database-driven and fully secure.