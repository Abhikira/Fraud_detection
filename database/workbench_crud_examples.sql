-- FraudWatch: edit and delete data from MySQL Workbench.
-- Connect Workbench to the same MySQL server and database as backend/.env.
-- Run SELECTs first and replace example IDs/values before running UPDATE/DELETE.

USE fraud_db;

-- Confirm this is the same server/database used by the backend.
SELECT DATABASE() AS selected_database, @@hostname AS mysql_host, @@port AS mysql_port;

-- Browse account data. Never select or edit password_hash.
SELECT id, full_name, email, phone, role, created_at
FROM users
ORDER BY id;

SELECT
    o.id,
    o.full_name,
    o.email,
    o.role,
    d.name AS department
FROM officers AS o
LEFT JOIN departments AS d ON d.id = o.dept_id
ORDER BY o.id;

SELECT id, name, description
FROM fraud_categories
ORDER BY name;

SELECT
    r.id AS report_id,
    r.title,
    r.status AS report_status,
    u.full_name AS citizen,
    fc.name AS category,
    c.id AS case_id,
    c.case_status,
    c.priority,
    o.full_name AS assigned_officer
FROM fraud_reports AS r
JOIN users AS u ON u.id = r.user_id
JOIN fraud_categories AS fc ON fc.id = r.category_id
LEFT JOIN cases AS c ON c.report_id = r.id
LEFT JOIN officers AS o ON o.id = c.officer_id
ORDER BY r.reported_at DESC;

-- UPDATE EXAMPLE: edit a citizen profile. Change the ID and values first.
-- Run just this transaction after verifying the target with the SELECT above.
-- START TRANSACTION;
-- UPDATE users
-- SET full_name = 'Updated Citizen Name',
--     email = 'updated-citizen@example.com',
--     phone = '555-0100'
-- WHERE id = 123
--   AND role = 'citizen';
-- SELECT ROW_COUNT() AS rows_updated;
-- COMMIT;

-- UPDATE EXAMPLE: change an officer profile/department.
-- Find department IDs with: SELECT id, name FROM departments ORDER BY name;
-- START TRANSACTION;
-- UPDATE officers
-- SET full_name = 'Updated Officer Name',
--     email = 'updated-officer@example.com',
--     dept_id = 1
-- WHERE id = 1
--   AND role = 'officer';
-- SELECT ROW_COUNT() AS rows_updated;
-- COMMIT;

-- DELETE EXAMPLE: delete a citizen only if they have no linked data.
-- This guard matches the app's account deletion rules.
-- Replace 123 with the citizen ID and inspect the row first.
-- START TRANSACTION;
-- DELETE FROM users
-- WHERE id = 123
--   AND role = 'citizen'
--   AND NOT EXISTS (
--       SELECT 1 FROM fraud_reports AS r WHERE r.user_id = users.id
--   )
--   AND NOT EXISTS (
--       SELECT 1 FROM notifications AS n WHERE n.user_id = users.id
--   )
--   AND NOT EXISTS (
--       SELECT 1 FROM comments AS c WHERE c.user_id = users.id
--   );
-- SELECT ROW_COUNT() AS rows_deleted;
-- COMMIT;

-- DELETE EXAMPLE: delete an officer only if they have no linked cases/comments.
-- Replace 1 with the officer ID and inspect the row first.
-- START TRANSACTION;
-- DELETE FROM officers
-- WHERE id = 1
--   AND role = 'officer'
--   AND NOT EXISTS (
--       SELECT 1 FROM cases AS c WHERE c.officer_id = officers.id
--   )
--   AND NOT EXISTS (
--       SELECT 1 FROM comments AS c WHERE c.officer_id = officers.id
--   );
-- SELECT ROW_COUNT() AS rows_deleted;
-- COMMIT;

-- DELETE EXAMPLE: delete a department only if no officer is assigned to it.
-- START TRANSACTION;
-- DELETE FROM departments
-- WHERE id = 1
--   AND NOT EXISTS (
--       SELECT 1 FROM officers AS o WHERE o.dept_id = departments.id
--   );
-- SELECT ROW_COUNT() AS rows_deleted;
-- COMMIT;

-- Do not update password_hash directly: use the admin dashboard to reset
-- passwords so the application stores a valid password hash.
-- Prefer changing case status through the app so status_logs stay accurate.



START TRANSACTION;
 UPDATE users
SET full_name = 'Neha',   
 email = 'gourav123@gmail.com',
    phone = '9876543210'
 WHERE id = 1
   AND role = 'citizen';
 SELECT ROW_COUNT() AS rows_updated;
 COMMIT;