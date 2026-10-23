-- LEADS SIC (Safety Induction Course tracker) - SQL Server schema.
-- Applied automatically when the app first connects (src/server/db.server.ts), after creating
-- the database if needed. Safe to re-run: every object is created only if it does not exist.
-- Separate batches with a line containing only GO. To apply by hand:
--   sqlcmd -S <server> -U <user> -P <password> -d leads_sic_lovable -i database/schema.sql

SET NOCOUNT ON;

-- Accounts. admin = can add, edit and delete; viewer = read only.
IF OBJECT_ID(N'dbo.users', N'U') IS NULL
CREATE TABLE dbo.users (
  id            UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_users PRIMARY KEY DEFAULT NEWID(),
  email         NVARCHAR(320)    NOT NULL CONSTRAINT uq_users_email UNIQUE,
  password_hash NVARCHAR(256)    NOT NULL,
  role          NVARCHAR(10)     NOT NULL CONSTRAINT df_users_role DEFAULT N'viewer'
    CONSTRAINT ck_users_role CHECK (role IN (N'admin', N'viewer')),
  created_at    DATETIME2(3)     NOT NULL CONSTRAINT df_users_created_at DEFAULT SYSUTCDATETIME()
);

-- Login sessions. token_hash is the SHA-256 of the random token kept in the browser cookie.
IF OBJECT_ID(N'dbo.sessions', N'U') IS NULL
CREATE TABLE dbo.sessions (
  token_hash CHAR(64)         NOT NULL CONSTRAINT pk_sessions PRIMARY KEY,
  user_id    UNIQUEIDENTIFIER NOT NULL
    CONSTRAINT fk_sessions_user REFERENCES dbo.users(id) ON DELETE CASCADE,
  expires_at DATETIME2(3)     NOT NULL,
  created_at DATETIME2(3)     NOT NULL CONSTRAINT df_sessions_created_at DEFAULT SYSUTCDATETIME()
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_sessions_user_id')
  CREATE INDEX ix_sessions_user_id ON dbo.sessions(user_id);

-- Uploaded files (site images, technician photos, attachments). Rows elsewhere point here by id;
-- files no row points to any more are removed on a later upload (src/lib/files.functions.ts).
IF OBJECT_ID(N'dbo.files', N'U') IS NULL
CREATE TABLE dbo.files (
  id           UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_files PRIMARY KEY DEFAULT NEWID(),
  file_name    NVARCHAR(260)    NOT NULL,
  content_type NVARCHAR(200)    NOT NULL,
  data         VARBINARY(MAX)   NOT NULL,
  created_at   DATETIME2(3)     NOT NULL CONSTRAINT df_files_created_at DEFAULT SYSUTCDATETIME()
);

IF OBJECT_ID(N'dbo.sites', N'U') IS NULL
CREATE TABLE dbo.sites (
  id         UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_sites PRIMARY KEY DEFAULT NEWID(),
  name       NVARCHAR(300)    NOT NULL,
  image_id   UNIQUEIDENTIFIER NULL CONSTRAINT fk_sites_image REFERENCES dbo.files(id),
  created_at DATETIME2(3)     NOT NULL CONSTRAINT df_sites_created_at DEFAULT SYSUTCDATETIME()
);

IF OBJECT_ID(N'dbo.departments', N'U') IS NULL
CREATE TABLE dbo.departments (
  id         UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_departments PRIMARY KEY DEFAULT NEWID(),
  name       NVARCHAR(200)    NOT NULL CONSTRAINT uq_departments_name UNIQUE,
  created_at DATETIME2(3)     NOT NULL CONSTRAINT df_departments_created_at DEFAULT SYSUTCDATETIME()
);

IF OBJECT_ID(N'dbo.employees', N'U') IS NULL
CREATE TABLE dbo.employees (
  id            UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_employees PRIMARY KEY DEFAULT NEWID(),
  name          NVARCHAR(300)    NOT NULL,
  designation   NVARCHAR(200)    NULL,
  image_id      UNIQUEIDENTIFIER NULL CONSTRAINT fk_employees_image REFERENCES dbo.files(id),
  status        NVARCHAR(20)     NOT NULL CONSTRAINT df_employees_status DEFAULT N'active',
  department_id UNIQUEIDENTIFIER NULL
    CONSTRAINT fk_employees_department REFERENCES dbo.departments(id) ON DELETE SET NULL,
  created_at    DATETIME2(3)     NOT NULL CONSTRAINT df_employees_created_at DEFAULT SYSUTCDATETIME()
);

IF OBJECT_ID(N'dbo.sic_records', N'U') IS NULL
CREATE TABLE dbo.sic_records (
  id            UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_sic_records PRIMARY KEY DEFAULT NEWID(),
  site_id       UNIQUEIDENTIFIER NOT NULL
    CONSTRAINT fk_sic_records_site REFERENCES dbo.sites(id) ON DELETE CASCADE,
  employee_id   UNIQUEIDENTIFIER NOT NULL
    CONSTRAINT fk_sic_records_employee REFERENCES dbo.employees(id) ON DELETE CASCADE,
  sic_date      DATE             NOT NULL,
  pass_issued   BIT              NOT NULL CONSTRAINT df_sic_records_pass_issued DEFAULT 1,
  expiry_date   DATE             NULL,
  attachment_id UNIQUEIDENTIFIER NULL CONSTRAINT fk_sic_records_attachment REFERENCES dbo.files(id),
  created_at    DATETIME2(3)     NOT NULL CONSTRAINT df_sic_records_created_at DEFAULT SYSUTCDATETIME()
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_sic_records_site_id')
  CREATE INDEX ix_sic_records_site_id ON dbo.sic_records(site_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_sic_records_employee_id')
  CREATE INDEX ix_sic_records_employee_id ON dbo.sic_records(employee_id);

IF OBJECT_ID(N'dbo.booking_instructions', N'U') IS NULL
CREATE TABLE dbo.booking_instructions (
  id             UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_booking_instructions PRIMARY KEY DEFAULT NEWID(),
  site_id        UNIQUEIDENTIFIER NOT NULL
    CONSTRAINT fk_booking_instructions_site REFERENCES dbo.sites(id) ON DELETE CASCADE,
  contact_person NVARCHAR(300)    NOT NULL,
  email          NVARCHAR(320)    NOT NULL,
  mobile         NVARCHAR(50)     NOT NULL,
  sic_session    NVARCHAR(500)    NULL,
  remarks        NVARCHAR(MAX)    NULL,
  note           NVARCHAR(MAX)    NULL,
  attachment_id  UNIQUEIDENTIFIER NULL
    CONSTRAINT fk_booking_instructions_attachment REFERENCES dbo.files(id),
  created_at     DATETIME2(3)     NOT NULL CONSTRAINT df_booking_instructions_created_at DEFAULT SYSUTCDATETIME()
);

-- Records one-time steps (the starter data below) so they never run twice.
IF OBJECT_ID(N'dbo.app_meta', N'U') IS NULL
CREATE TABLE dbo.app_meta (
  [key]      NVARCHAR(100) NOT NULL CONSTRAINT pk_app_meta PRIMARY KEY,
  created_at DATETIME2(3)  NOT NULL CONSTRAINT df_app_meta_created_at DEFAULT SYSUTCDATETIME()
);
GO

-- Starter data, inserted once into a new database (same as the original app's first migrations).
IF NOT EXISTS (SELECT 1 FROM dbo.app_meta WHERE [key] = N'seed_v1')
BEGIN
  SET XACT_ABORT ON;
  BEGIN TRANSACTION;

  INSERT INTO dbo.departments (name) VALUES
    (N'Electrical'), (N'Mechanical'), (N'Instrumentation'), (N'Civil');

  INSERT INTO dbo.sites (name) VALUES
    (N'AstraZeneca - UTOC'), (N'Vopak Singapore - Penjuru Terminal'), (N'Micron Woodland'),
    (N'UTOC - SHELL TUAS'), (N'Crystal Offshore Pte Ltd'), (N'Utoc-Neste'),
    (N'Evonik Maintenance - ME5 Site'), (N'Banyan Caverns Storage Services PTE LTD'),
    (N'Seatrium'), (N'JIAN MAN');

  INSERT INTO dbo.employees (name, designation) VALUES
    (N'Shanmugam Nithishwaran', N'Technician'), (N'Vamsumani Madheshwaran', N'Technician'),
    (N'Renganathan Prasanth', N'Supervisor'), (N'Ganesan Shinu', N'Technician'),
    (N'Ravichandran Gokul', N'Technician'), (N'Maria Jebastin', N'Technician'),
    (N'Dhamodaran', N'Supervisor'), (N'Arulkumar', N'Technician'), (N'Jayapandian', N'Technician'),
    (N'Chandran Karthikeyan', N'Technician'), (N'Sasikumar', N'Technician');

  INSERT INTO dbo.sic_records (site_id, employee_id, sic_date, expiry_date)
  SELECT s.id, e.id, v.d, v.x FROM (VALUES
    (N'Crystal Offshore Pte Ltd', N'Shanmugam Nithishwaran', '2026-10-15', '2027-10-15'),
    (N'Utoc-Neste', N'Maria Jebastin', '2026-07-29', '2027-07-29'),
    (N'Utoc-Neste', N'Vamsumani Madheshwaran', '2026-07-29', '2027-07-29'),
    (N'Utoc-Neste', N'Arulkumar', '2025-07-29', '2026-10-30'),
    (N'AstraZeneca - UTOC', N'Shanmugam Nithishwaran', '2026-10-06', '2027-10-06'),
    (N'AstraZeneca - UTOC', N'Dhamodaran', '2026-10-06', '2027-10-06'),
    (N'Vopak Singapore - Penjuru Terminal', N'Jayapandian', '2025-08-25', '2026-08-25'),
    (N'Banyan Caverns Storage Services PTE LTD', N'Chandran Karthikeyan', '2025-10-27', '2026-10-27'),
    (N'JIAN MAN', N'Sasikumar', '2025-11-05', '2026-11-05'),
    (N'Micron Woodland', N'Ganesan Shinu', '2026-03-01', '2027-03-01')
  ) v(s, e, d, x)
  JOIN dbo.sites s ON s.name = v.s
  JOIN dbo.employees e ON e.name = v.e;

  INSERT INTO dbo.booking_instructions (site_id, contact_person, email, mobile, sic_session, remarks, note)
  SELECT s.id, v.c, v.m, v.p, v.ss, v.r, v.n FROM (VALUES
    (N'Seatrium', N'Muhammad Abdillah', N'piksun.seong@seatrium.com', N'87796410', N'Mon & Wed 8:30am', N'Bring NRIC/work permit', N'Book 3 days ahead'),
    (N'Utoc-Neste', N'Annie Chua', N'annie.chua@example.com', N'68681368', N'Daily 9am', N'PPE required', N'Email to confirm slot')
  ) v(s, c, m, p, ss, r, n)
  JOIN dbo.sites s ON s.name = v.s;

  INSERT INTO dbo.app_meta ([key]) VALUES (N'seed_v1');
  COMMIT TRANSACTION;
END
