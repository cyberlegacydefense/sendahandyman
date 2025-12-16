-- Cleanup Script for Test Handyman Accounts
-- Run this in your Supabase SQL Editor to remove test accounts

-- =====================================================
-- STEP 1: Review what will be deleted
-- =====================================================

-- Show all test accounts that will be deleted
SELECT
    h.id as handyman_id,
    h.user_id as auth_user_id,
    h.full_name,
    h.email,
    h.created_at,
    CASE
        WHEN h.full_name IS NULL OR h.full_name = '' THEN 'EMPTY DUPLICATE'
        WHEN h.email LIKE '%test%' OR h.email LIKE '%debug%' THEN 'TEST ACCOUNT'
        ELSE 'KEEP'
    END as action_reason
FROM handymen h
WHERE
    -- Test accounts based on email patterns
    h.email LIKE '%test%'
    OR h.email LIKE '%debug%'
    OR h.email LIKE '%example.com%'
    -- Empty duplicates
    OR h.full_name IS NULL
    OR h.full_name = ''
ORDER BY h.created_at DESC;

-- Count of accounts to be deleted
SELECT
    COUNT(*) as total_to_delete,
    COUNT(CASE WHEN full_name IS NULL OR full_name = '' THEN 1 END) as empty_duplicates,
    COUNT(CASE WHEN email LIKE '%test%' OR email LIKE '%debug%' THEN 1 END) as test_accounts
FROM handymen
WHERE
    email LIKE '%test%'
    OR email LIKE '%debug%'
    OR email LIKE '%example.com%'
    OR full_name IS NULL
    OR full_name = '';

-- =====================================================
-- STEP 2: BACKUP (Optional but recommended)
-- =====================================================

-- Create backup table (uncomment if you want to keep a backup)
/*
CREATE TABLE handymen_backup_20241216 AS
SELECT * FROM handymen
WHERE
    email LIKE '%test%'
    OR email LIKE '%debug%'
    OR email LIKE '%example.com%'
    OR full_name IS NULL
    OR full_name = '';
*/

-- =====================================================
-- STEP 3: Delete test handyman records
-- =====================================================

-- UNCOMMENT THE LINES BELOW AFTER REVIEWING STEP 1 RESULTS

/*
DELETE FROM handymen
WHERE
    -- Test accounts based on email patterns
    email LIKE '%test%'
    OR email LIKE '%debug%'
    OR email LIKE '%example.com%'
    -- Empty duplicates (records without names)
    OR full_name IS NULL
    OR full_name = '';
*/

-- =====================================================
-- STEP 4: Clean up orphaned auth users (Advanced)
-- =====================================================

-- Note: This shows auth users that might be orphaned after cleanup
-- You'll need to delete these manually in Supabase Auth dashboard
-- or use the admin API if you have access

/*
-- This query shows auth users that correspond to deleted handymen
-- You can use this to manually clean them up in the Auth dashboard

SELECT
    au.id,
    au.email,
    au.created_at,
    'DELETE FROM auth.users WHERE id = ''' || au.id || ''';' as delete_command
FROM auth.users au
WHERE au.email IN (
    -- List of test emails to clean up
    SELECT DISTINCT email FROM (
        VALUES
            ('newtestdec180@gmail.com'),
            ('newtestdec170@gmail.com'),
            ('newtestdec166@gmail.com'),
            ('newtestdec165@gmail.com'),
            ('newtestdec164@gmail.com'),
            ('newtestdec163@gmail.com'),
            ('newtestdec162@gmail.com'),
            ('newtestdec16@gmail.com'),
            ('debug-test-dec16@example.com'),
            ('newtestdec192@gmail.com')
        ) as test_emails(email)
);
*/

-- =====================================================
-- STEP 5: Verification
-- =====================================================

-- Run this after cleanup to verify results
/*
SELECT
    COUNT(*) as remaining_handymen,
    COUNT(CASE WHEN full_name IS NOT NULL AND full_name != '' THEN 1 END) as with_names,
    COUNT(CASE WHEN full_name IS NULL OR full_name = '' THEN 1 END) as without_names,
    COUNT(CASE WHEN email LIKE '%test%' OR email LIKE '%debug%' THEN 1 END) as remaining_test_accounts
FROM handymen;
*/

-- Show remaining handymen after cleanup
/*
SELECT
    full_name,
    email,
    created_at,
    onboarding_completed
FROM handymen
ORDER BY created_at DESC
LIMIT 20;
*/