
USE fraud_db;

SELECT 'users' AS table_name, COUNT(*) AS record_count FROM users
UNION ALL
SELECT 'officers', COUNT(*) FROM officers
UNION ALL
SELECT 'departments', COUNT(*) FROM departments
UNION ALL
SELECT 'fraud_reports', COUNT(*) FROM fraud_reports
UNION ALL
SELECT 'cases', COUNT(*) FROM cases
UNION ALL
SELECT 'evidence', COUNT(*) FROM evidence;

-- Inspect citizen accounts without exposing password hashes.
SELECT id, full_name, email, phone, role, created_at
FROM users
ORDER BY id;

-- Inspect officers and their department names.
SELECT o.id, o.full_name, o.email, o.role, d.name AS department
FROM officers AS o
LEFT JOIN departments AS d ON d.id = o.dept_id
ORDER BY o.id;

-- View reports with their citizen, category, case, and assigned officer.
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

-- Example profile update: replace the example values before uncommenting.
-- UPDATE users
-- SET full_name = 'Updated Name', phone = '555-0100'
-- WHERE id = 1 AND role = 'citizen';

-- Example case assignment: replace IDs before uncommenting.
-- UPDATE cases SET officer_id = 1 WHERE id = 1;

-- Create officers, reset passwords, and delete accounts through the admin
-- dashboard. It hashes passwords and prevents deleting accounts with records.
