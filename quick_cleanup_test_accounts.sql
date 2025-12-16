-- Quick Test Account Cleanup
-- Simple script to remove obvious test accounts

-- STEP 1: See what will be deleted
SELECT
    full_name,
    email,
    created_at
FROM handymen
WHERE
    email LIKE '%testdec%'
    OR email LIKE '%debug%'
    OR email LIKE '%example.com%'
    OR full_name ILIKE '%test%'
ORDER BY created_at DESC;

-- STEP 2: Count them
SELECT COUNT(*) as test_accounts_to_delete
FROM handymen
WHERE
    email LIKE '%testdec%'
    OR email LIKE '%debug%'
    OR email LIKE '%example.com%'
    OR full_name ILIKE '%test%';

-- STEP 3: Delete them (UNCOMMENT after reviewing above)
/*
DELETE FROM handymen
WHERE
    email LIKE '%testdec%'
    OR email LIKE '%debug%'
    OR email LIKE '%example.com%'
    OR full_name ILIKE '%test%';
*/

-- STEP 4: Verify cleanup
/*
SELECT
    full_name,
    email,
    created_at,
    onboarding_completed
FROM handymen
ORDER BY created_at DESC;
*/