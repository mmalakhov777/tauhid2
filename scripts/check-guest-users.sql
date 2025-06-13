-- Check guest user statistics
-- Run this to see the current state of guest users in your database

-- Total guest users
SELECT 
  'Total Guest Users' as metric,
  COUNT(*) as count
FROM "User" 
WHERE email LIKE 'guest-%';

-- Guest users with no chats (completely unused)
SELECT 
  'Unused Guest Users' as metric,
  COUNT(*) as count
FROM "User" u
LEFT JOIN "Chat" c ON u.id = c."userId"
WHERE u.email LIKE 'guest-%' 
  AND c.id IS NULL;

-- Guest users with chats
SELECT 
  'Guest Users with Chats' as metric,
  COUNT(*) as count
FROM "User" u
INNER JOIN "Chat" c ON u.id = c."userId"
WHERE u.email LIKE 'guest-%';

-- Recent guest users (last 24 hours)
SELECT 
  'Recent Guest Users (24h)' as metric,
  COUNT(*) as count
FROM "User" 
WHERE email LIKE 'guest-%'
  AND EXTRACT(EPOCH FROM TO_TIMESTAMP(SUBSTRING(email, 7)::bigint / 1000)) > EXTRACT(EPOCH FROM NOW() - INTERVAL '24 hours');

-- Sample of guest user emails (first 10)
SELECT 
  'Sample Guest Emails' as metric,
  email
FROM "User" 
WHERE email LIKE 'guest-%'
ORDER BY email
LIMIT 10; 