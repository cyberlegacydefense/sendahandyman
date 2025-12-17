-- Quick fix to confirm emails for handymen who can't login
-- Run this in your Supabase SQL Editor

-- First, check which auth users are not confirmed
SELECT
    au.id,
    au.email,
    au.email_confirmed_at,
    au.created_at,
    CASE
        WHEN au.email_confirmed_at IS NULL THEN 'NOT CONFIRMED'
        ELSE 'CONFIRMED'
    END as status
FROM auth.users au
INNER JOIN handymen h ON h.user_id = au.id
WHERE au.email_confirmed_at IS NULL
ORDER BY au.created_at DESC;

-- To manually confirm emails for handymen (UNCOMMENT after reviewing above):
/*
UPDATE auth.users
SET
    email_confirmed_at = NOW(),
    updated_at = NOW()
WHERE id IN (
    SELECT au.id
    FROM auth.users au
    INNER JOIN handymen h ON h.user_id = au.id
    WHERE au.email_confirmed_at IS NULL
);
*/

-- Verify the fix worked:
/*
SELECT
    au.email,
    au.email_confirmed_at,
    'NOW CONFIRMED' as status
FROM auth.users au
INNER JOIN handymen h ON h.user_id = au.id
WHERE au.email = 'papitonysallinone@outlook.com';
*/