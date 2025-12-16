-- Cleanup script for duplicate handyman entries
-- Run this in your Supabase SQL Editor to remove duplicate handyman records

-- Step 1: Identify duplicate handyman records (shows what will be deleted)
SELECT
    id,
    user_id,
    email,
    full_name,
    created_at,
    CASE
        WHEN full_name IS NULL OR full_name = '' THEN 'WILL BE DELETED'
        ELSE 'WILL BE KEPT'
    END as action
FROM handymen
WHERE user_id IN (
    SELECT user_id
    FROM handymen
    GROUP BY user_id
    HAVING COUNT(*) > 1
)
ORDER BY user_id, created_at;

-- Step 2: Delete duplicate handyman records without full_name
-- UNCOMMENT THE LINE BELOW AFTER REVIEWING THE RESULTS FROM STEP 1
-- DELETE FROM handymen WHERE full_name IS NULL OR full_name = '';

-- Step 3: Verify cleanup (should show no duplicates)
-- UNCOMMENT THE LINES BELOW AFTER RUNNING THE DELETE
-- SELECT user_id, COUNT(*) as count
-- FROM handymen
-- GROUP BY user_id
-- HAVING COUNT(*) > 1;