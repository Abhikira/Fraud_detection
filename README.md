# Fraud Reporting and Case Management

A full-stack application using FastAPI, MySQL, SQLAlchemy, and a plain HTML/CSS/JavaScript frontend served by Vite.

## Requirements

- Python 3.10 or later
- Node.js and npm
- MySQL Server running locally

## Configure MySQL

### Create the database in MySQL Workbench

1. Open `database/mysql_workbench.sql` in MySQL Workbench.
2. Run the entire script (lightning-bolt button). It creates the `fraud_db` database, all ten application tables, foreign-key relationships, and the default fraud categories.
3. Confirm the `SHOW TABLES` result contains `cases`, `comments`, `departments`, `evidence`, `fraud_categories`, `fraud_reports`, `notifications`, `officers`, `status_logs`, and `users`.
4. Copy `backend/.env.example` to `backend/.env`, then set the MySQL username/password, a random `SECRET_KEY` of at least 32 characters, and the admin login. Set `DB_NAME` to the database you created if you chose a name other than `fraud_db`. Keep `.env` private.

The schema script uses `CREATE DATABASE/TABLE IF NOT EXISTS`; it does not drop tables or erase existing data. The application also runs SQLAlchemy `create_all` at startup, which creates missing tables but does not migrate or alter existing columns. The current officer/account management features use the existing `users`, `officers`, and `departments` tables, so no additional `ALTER TABLE` migration is required.

For direct database inspection and editing while the app is running, open `database/workbench_crud_examples.sql` in Workbench. Connect to the same MySQL host, port, and database shown by `DB_HOST`, `DB_PORT`, and `DB_NAME` in `backend/.env`; run its connection-check query first. The file includes browse queries, commented profile updates, and guarded account/department deletes. Review the selected row and replace example IDs/values before uncommenting and running one transaction at a time. A successful SQL change is visible to the app on its next request or page refresh.

Use the optional `database/admin_queries.sql` for record counts and report/case joins. Do not edit `password_hash` directly or change case status directly in Workbench: use the admin dashboard to reset passwords and update case status, so password hashes and status history remain correct. Account email changes may require signing in again.

The backend creates the application tables and default report categories at startup. It also creates or updates the configured admin account and creates configured Gourav and Ujjwal officer accounts when they do not already exist. From the officer dashboard, administrators can add officers and departments, manage officer and citizen profiles, reset passwords, and assign officers to departments. These changes are saved in the configured MySQL database; passwords are stored as hashes. Accounts with linked reports, cases, comments, or notifications cannot be deleted. Existing reports, cases, and categories are preserved.

Citizens can attach one JPEG, PNG, or WebP evidence image (up to 5 MB) when filing a report. Images are validated and stored privately; only the report owner, an assigned officer, and an administrator can view them. Administrators can see every report and case, assign cases, and update any case. Officers can view and update only cases assigned to them.

### Configure using SQL (alternative)

If you prefer to create only the database first, run:

```sql
CREATE DATABASE IF NOT EXISTS fraud_db
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;
```

## Start the backend and frontend

Start MySQL Server first. If you have not created the tables yet, run `database/mysql_workbench.sql` in MySQL Workbench and configure `backend/.env` as described above.

### Terminal 1: backend API

Open PowerShell in the project root (`D:\Fraud_detection`) and run:

```powershell
Set-Location D:\Fraud_detection
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
Set-Location backend
..\.venv\Scripts\python.exe -m uvicorn main:app --reload
```

Wait until Uvicorn reports that the application startup is complete. The API and interactive docs are available at `http://127.0.0.1:8000` and `http://127.0.0.1:8000/docs`.

### Terminal 2: frontend

Open a second PowerShell window in the project root and run:

```powershell
Set-Location D:\Fraud_detection\frontend
npm install
npm run dev
```

Open the **Local** URL Vite prints (normally `http://localhost:5173`). Vite forwards `/api` requests to the backend at `http://127.0.0.1:8000`.

The frontend is plain HTML, CSS, and JavaScript; React and React Router are not used. `npm install` is needed once after checkout or dependency changes. After that, use `npm run dev` to start the frontend. Leave both terminal windows open while using the app; press **Ctrl+C** in each to stop the services.

If the API is hosted at a different address, set `VITE_API_URL` before starting Vite:

```powershell
$env:VITE_API_URL = "http://127.0.0.1:8000"
Set-Location D:\Fraud_detection\frontend
npm run dev
```
