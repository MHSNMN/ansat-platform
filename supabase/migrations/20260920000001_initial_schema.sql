-- ==============================================================================
-- Supabase Migration: 20260920000001_initial_schema.sql
-- المنظومة التشغيلية المتكاملة لمنصة إنصات (Ensat Platform)
-- نقل البيانات التشغيلية والصلاحيات والمهام والمكتبة من Firestore إلى Supabase
-- ==============================================================================

-- Enable UUID extension if available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ENUMS
DO $$ BEGIN
    CREATE TYPE override_state AS ENUM ('ALLOW', 'DENY', 'INHERIT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE account_status AS ENUM ('ACTIVE', 'PENDING', 'SUSPENDED', 'REVIEW');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. ROLES TABLE
CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    name_ar TEXT NOT NULL,
    description TEXT,
    is_system_role BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. PERMISSIONS TABLE
CREATE TABLE IF NOT EXISTS permissions (
    id TEXT PRIMARY KEY,
    permission_key TEXT NOT NULL UNIQUE,
    name_ar TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ROLE_PERMISSIONS (M2M)
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (role_id, permission_id)
);

-- 5. PROFILES (MEMBERS) TABLE
-- Linked strictly via firebase_uid
CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY DEFAULT ('usr_' || substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
    firebase_uid TEXT UNIQUE NOT NULL,
    email TEXT NOT NULL,
    username TEXT UNIQUE,
    full_name TEXT NOT NULL,
    display_name TEXT,
    phone TEXT,
    phone_normalized TEXT,
    country TEXT,
    nationality TEXT,
    show_nationality_public BOOLEAN DEFAULT false,
    role_id TEXT NOT NULL REFERENCES roles(id) DEFAULT 'member',
    status account_status NOT NULL DEFAULT 'ACTIVE',
    is_super_admin BOOLEAN NOT NULL DEFAULT false,
    avatar_url TEXT,
    notes TEXT,
    token_version INTEGER NOT NULL DEFAULT 1,
    -- Soft Archive
    is_archived BOOLEAN NOT NULL DEFAULT false,
    archived_at TIMESTAMPTZ,
    archived_by TEXT,
    -- Audit Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique index for non-empty normalized phone numbers
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_phone_normalized_unique
    ON profiles (phone_normalized) WHERE (phone_normalized IS NOT NULL AND phone_normalized <> '');

CREATE INDEX IF NOT EXISTS idx_profiles_firebase_uid ON profiles(firebase_uid);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role_id ON profiles(role_id);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON profiles(status);
CREATE INDEX IF NOT EXISTS idx_profiles_is_archived ON profiles(is_archived);

-- 6. USER PERMISSION OVERRIDES (ALLOW, DENY, INHERIT)
CREATE TABLE IF NOT EXISTS user_permission_overrides (
    id TEXT PRIMARY KEY DEFAULT ('ovr_' || substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
    profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    state override_state NOT NULL DEFAULT 'INHERIT',
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (profile_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_user_permission_overrides_profile ON user_permission_overrides(profile_id);

-- 7. PLATFORM ACCESS
CREATE TABLE IF NOT EXISTS platform_access (
    id TEXT PRIMARY KEY DEFAULT ('pla_' || substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
    profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    platform_id TEXT NOT NULL, -- 'recording', 'tasks', 'rewards', 'admin'
    is_allowed BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (profile_id, platform_id)
);

CREATE INDEX IF NOT EXISTS idx_platform_access_profile ON platform_access(profile_id);

-- 8. BOOKS TABLE
CREATE TABLE IF NOT EXISTS books (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    description TEXT,
    category TEXT,
    target_chapters INTEGER DEFAULT 0,
    completed_chapters INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'PLANNED', -- 'PLANNED', 'RECORDING', 'REVIEW', 'MASTERING', 'COMPLETED', 'PUBLISHED'
    assigned_narrators TEXT[] DEFAULT '{}',
    drive_folder_id TEXT,
    drive_folder_link TEXT,
    pdf_drive_id TEXT,
    pdf_drive_link TEXT,
    cover_image_url TEXT,
    is_published_public BOOLEAN DEFAULT false,
    -- Soft Archive
    is_archived BOOLEAN NOT NULL DEFAULT false,
    archived_at TIMESTAMPTZ,
    archived_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_books_status ON books(status);
CREATE INDEX IF NOT EXISTS idx_books_is_archived ON books(is_archived);
CREATE INDEX IF NOT EXISTS idx_books_is_published ON books(is_published_public);

-- 9. CHAPTERS TABLE
CREATE TABLE IF NOT EXISTS chapters (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    chapter_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING',
    is_archived BOOLEAN NOT NULL DEFAULT false,
    archived_at TIMESTAMPTZ,
    archived_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (book_id, chapter_number)
);

CREATE INDEX IF NOT EXISTS idx_chapters_book_id ON chapters(book_id);

-- 10. RECORDINGS TABLE (Production Workflow)
CREATE TABLE IF NOT EXISTS recordings (
    id TEXT PRIMARY KEY,
    book_id TEXT REFERENCES books(id) ON DELETE SET NULL,
    book_title TEXT,
    chapter_id TEXT REFERENCES chapters(id) ON DELETE SET NULL,
    chapter_number INTEGER,
    narrator_profile_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
    narrator_name TEXT NOT NULL,
    reviewer_profile_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
    engineer_profile_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
    stage TEXT NOT NULL DEFAULT 'RAW', -- 'RAW', 'QA_REVIEW', 'MASTERING', 'APPROVED', 'PUBLISHED'
    status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'IN_PROGRESS', 'APPROVED', 'REJECTED'
    drive_file_id TEXT,
    drive_file_url TEXT,
    file_size BIGINT DEFAULT 0,
    duration_seconds NUMERIC(10,2) DEFAULT 0,
    audio_format TEXT,
    feedback_notes TEXT,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    archived_at TIMESTAMPTZ,
    archived_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recordings_book_id ON recordings(book_id);
CREATE INDEX IF NOT EXISTS idx_recordings_narrator ON recordings(narrator_profile_id);
CREATE INDEX IF NOT EXISTS idx_recordings_stage ON recordings(stage);
CREATE INDEX IF NOT EXISTS idx_recordings_status ON recordings(status);
CREATE INDEX IF NOT EXISTS idx_recordings_is_archived ON recordings(is_archived);

-- 11. PUBLIC LIBRARY (Published Audioworks)
CREATE TABLE IF NOT EXISTS public_library (
    id TEXT PRIMARY KEY,
    book_id TEXT REFERENCES books(id) ON DELETE SET NULL,
    recording_id TEXT REFERENCES recordings(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    narrator TEXT NOT NULL,
    audio_url TEXT NOT NULL,
    drive_file_id TEXT,
    duration_seconds NUMERIC(10,2) DEFAULT 0,
    cover_image_url TEXT,
    category TEXT,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'PUBLISHED',
    sort_order INTEGER DEFAULT 0,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    archived_at TIMESTAMPTZ,
    archived_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_public_library_status ON public_library(status);
CREATE INDEX IF NOT EXISTS idx_public_library_is_archived ON public_library(is_archived);

-- 12. ACTIVITIES (Events & Announcements)
CREATE TABLE IF NOT EXISTS activities (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    datetime TIMESTAMPTZ,
    location TEXT,
    category TEXT,
    status TEXT NOT NULL DEFAULT 'PUBLISHED',
    cover_image_url TEXT,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    archived_at TIMESTAMPTZ,
    archived_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activities_status ON activities(status);

-- 13. ACTIVITY MEDIA
CREATE TABLE IF NOT EXISTS activity_media (
    id TEXT PRIMARY KEY DEFAULT ('actm_' || substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
    activity_id TEXT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    media_url TEXT NOT NULL,
    media_type TEXT NOT NULL DEFAULT 'IMAGE', -- 'IMAGE', 'VIDEO', 'DOCUMENT'
    drive_file_id TEXT,
    caption TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_media_activity ON activity_media(activity_id);

-- 14. TASKS TABLE
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    platform TEXT NOT NULL DEFAULT 'tasks', -- 'recording', 'tasks', 'rewards'
    priority TEXT NOT NULL DEFAULT 'MEDIUM', -- 'LOW', 'MEDIUM', 'HIGH', 'URGENT'
    stage TEXT NOT NULL DEFAULT 'TODO', -- 'TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'
    status TEXT NOT NULL DEFAULT 'OPEN', -- 'OPEN', 'COMPLETED', 'CANCELLED', 'ARCHIVED'
    due_date TIMESTAMPTZ,
    book_id TEXT REFERENCES books(id) ON DELETE SET NULL,
    points_reward INTEGER DEFAULT 0,
    created_by_profile_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    archived_at TIMESTAMPTZ,
    archived_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_stage ON tasks(stage);
CREATE INDEX IF NOT EXISTS idx_tasks_is_archived ON tasks(is_archived);

-- 15. TASK ASSIGNMENTS (M2M)
CREATE TABLE IF NOT EXISTS task_assignments (
    id TEXT PRIMARY KEY DEFAULT ('tska_' || substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (task_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_task_assignments_task ON task_assignments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_assignments_profile ON task_assignments(profile_id);

-- 16. APPLICATION FORMS
CREATE TABLE IF NOT EXISTS application_forms (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'published', -- 'draft', 'published', 'closed'
    is_archived BOOLEAN NOT NULL DEFAULT false,
    archived_at TIMESTAMPTZ,
    archived_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 17. APPLICATION QUESTIONS
CREATE TABLE IF NOT EXISTS application_questions (
    id TEXT PRIMARY KEY,
    form_id TEXT NOT NULL REFERENCES application_forms(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type TEXT NOT NULL, -- 'text', 'textarea', 'radio', 'checkbox', 'file'
    options JSONB,
    is_required BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_questions_form ON application_questions(form_id);

-- 18. VOLUNTEER APPLICATIONS
CREATE TABLE IF NOT EXISTS volunteer_applications (
    id TEXT PRIMARY KEY,
    form_id TEXT REFERENCES application_forms(id) ON DELETE SET NULL,
    applicant_name TEXT NOT NULL,
    applicant_email TEXT NOT NULL,
    applicant_phone TEXT NOT NULL,
    applicant_phone_normalized TEXT,
    country TEXT,
    nationality TEXT,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    reviewer_notes TEXT,
    reviewed_by_profile_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    archived_at TIMESTAMPTZ,
    archived_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vol_applications_status ON volunteer_applications(status);

-- 19. APPLICATION ANSWERS
CREATE TABLE IF NOT EXISTS application_answers (
    id TEXT PRIMARY KEY DEFAULT ('ans_' || substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
    application_id TEXT NOT NULL REFERENCES volunteer_applications(id) ON DELETE CASCADE,
    question_id TEXT NOT NULL REFERENCES application_questions(id) ON DELETE CASCADE,
    answer_text TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (application_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_app_answers_app ON application_answers(application_id);

-- 20. GEM WALLETS
CREATE TABLE IF NOT EXISTS gem_wallets (
    profile_id TEXT PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    points_balance INTEGER NOT NULL DEFAULT 0 CHECK (points_balance >= 0),
    gems_balance INTEGER NOT NULL DEFAULT 0 CHECK (gems_balance >= 0),
    rest_days_balance INTEGER NOT NULL DEFAULT 0 CHECK (rest_days_balance >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 21. POINTS LEDGER
CREATE TABLE IF NOT EXISTS points_ledger (
    id TEXT PRIMARY KEY DEFAULT ('pt_' || substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
    profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL, -- can be positive (earned) or negative (spent)
    balance_after INTEGER NOT NULL,
    reason TEXT NOT NULL,
    reference_id TEXT,
    reference_type TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_points_ledger_profile ON points_ledger(profile_id);

-- 22. GEM TRANSACTIONS
CREATE TABLE IF NOT EXISTS gem_transactions (
    id TEXT PRIMARY KEY DEFAULT ('gtx_' || substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
    profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    transaction_type TEXT NOT NULL, -- 'PURCHASE', 'GIFT_SENT', 'GIFT_RECEIVED', 'REST_DAY_PURCHASE', 'ADMIN_ADJUSTMENT'
    amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    recipient_profile_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
    reference_id TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gem_transactions_profile ON gem_transactions(profile_id);

-- 23. CERTIFICATES
CREATE TABLE IF NOT EXISTS certificates (
    id TEXT PRIMARY KEY,
    certificate_code TEXT UNIQUE NOT NULL,
    profile_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
    recipient_name TEXT NOT NULL,
    course_name TEXT NOT NULL,
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expiry_date DATE,
    status TEXT NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'REVOKED'
    drive_file_id TEXT,
    drive_file_url TEXT,
    verify_url TEXT,
    revoked_at TIMESTAMPTZ,
    revoked_reason TEXT,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    archived_at TIMESTAMPTZ,
    archived_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_certificates_code ON certificates(certificate_code);
CREATE INDEX IF NOT EXISTS idx_certificates_profile ON certificates(profile_id);
CREATE INDEX IF NOT EXISTS idx_certificates_status ON certificates(status);

-- 24. SITE SECTIONS (Public Portal CMS)
CREATE TABLE IF NOT EXISTS site_sections (
    id TEXT PRIMARY KEY,
    section_key TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    subtitle TEXT,
    content JSONB NOT NULL DEFAULT '{}'::jsonb,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_visible BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 25. SITE SETTINGS
CREATE TABLE IF NOT EXISTS site_settings (
    id TEXT PRIMARY KEY,
    setting_key TEXT UNIQUE NOT NULL,
    setting_value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 26. AUDIT LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY DEFAULT ('aud_' || substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
    actor_profile_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
    actor_name TEXT NOT NULL,
    action_type TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    details TEXT,
    metadata JSONB,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_profile_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

-- 27. GOOGLE DRIVE FILES (Metadata ONLY)
CREATE TABLE IF NOT EXISTS drive_files (
    id TEXT PRIMARY KEY DEFAULT ('drv_' || substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
    drive_file_id TEXT UNIQUE NOT NULL,
    drive_folder_id TEXT,
    file_name TEXT NOT NULL,
    mime_type TEXT,
    file_size BIGINT DEFAULT 0,
    duration_seconds NUMERIC(10,2) DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'SYNCED', -- 'PENDING', 'SYNCED', 'FAILED'
    uploaded_by_profile_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drive_files_file_id ON drive_files(drive_file_id);
CREATE INDEX IF NOT EXISTS idx_drive_files_uploaded_by ON drive_files(uploaded_by_profile_id);

-- ==============================================================================
-- 28. INITIAL SEED DATA: CANONICAL ROLES
-- ==============================================================================
INSERT INTO roles (id, name, name_ar, description, is_system_role)
VALUES
    ('super_admin', 'SUPER_ADMIN', 'إدارة عليا', 'كامل صلاحيات النظام والتحكم الشامل', true),
    ('admin', 'ADMIN', 'مدير عام', 'إدارة الأعضاء والعمليات والكتب والمحتوى', true),
    ('content_manager', 'CONTENT_MANAGER', 'مدير المحتوى والواجهة', 'إدارة الواجهة العامة والمكتبة والأنشطة', true),
    ('members_manager', 'MEMBERS_MANAGER', 'مسؤول شؤون الأعضاء', 'إدارة طلبات التطوع وحسابات الأعضاء', true),
    ('operations_manager', 'OPERATIONS_MANAGER', 'مدير العمليات والمهام', 'توزيع ومتابعة المهام ومسارات الإنتاج', true),
    ('audio_engineer', 'AUDIO_ENGINEER', 'مهندس صوت', 'هندسة وماسترينغ التسجيلات الصوتية', true),
    ('qa_reviewer', 'QA_REVIEWER', 'مراجع جودة ولغة', 'مراجعة وتدقيق التسجيلات وضمان الجودة', true),
    ('narrator', 'NARRATOR', 'راوي / قارئ', 'تسجيل الفصول ورفع الصوت الخام', true),
    ('rewards_manager', 'REWARDS_MANAGER', 'مدير النقاط والمكافآت', 'إدارة نظام التحفيز والمكافآت والشهادات', true),
    ('certificate_manager', 'CERTIFICATE_MANAGER', 'مدير الشهادات', 'إصدار والتحقق من الشهادات الرسمية', true),
    ('member', 'MEMBER', 'عضو فاعل', 'المشاركة في المهام العامة ومتابعة المكافآت', true),
    ('pending', 'PENDING', 'بانتظار التفعيل', 'حساب مسجل قيد المراجعة الإدارية', true),
    ('suspended', 'SUSPENDED', 'موقوف', 'حساب معطل وممنوع من الوصول للمنصات', true)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    name_ar = EXCLUDED.name_ar,
    description = EXCLUDED.description;

-- ==============================================================================
-- 29. EMBEDDED TASKS & STATE SYNCHRONIZATION TABLES
-- ==============================================================================

-- JSON app state storage for tasks manager
CREATE TABLE IF NOT EXISTS app_state (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Settings key-value store
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value JSONB,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Legacy/Embedded members table
CREATE TABLE IF NOT EXISTS members (
    id TEXT PRIMARY KEY DEFAULT ('mem_' || substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
    name TEXT,
    whatsapp TEXT,
    code TEXT,
    department TEXT,
    role TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Legacy/Embedded users table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT,
    code TEXT,
    whatsapp TEXT,
    role_name TEXT,
    department_name TEXT,
    is_admin BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Departments table
CREATE TABLE IF NOT EXISTS departments (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT,
    color TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cloud folders table
CREATE TABLE IF NOT EXISTS cloud_folders (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT,
    department_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activity logs for tasks
CREATE TABLE IF NOT EXISTS activity_logs (
    id TEXT PRIMARY KEY DEFAULT ('actlog_' || substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
    user_id TEXT,
    user_name TEXT,
    action TEXT,
    target TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY DEFAULT ('ntf_' || substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
    user_id TEXT,
    title TEXT,
    message TEXT,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
