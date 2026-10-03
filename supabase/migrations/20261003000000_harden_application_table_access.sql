-- The authenticated Express API uses the service role. Browser roles must not
-- query or mutate private application tables directly.
DO $migration$
DECLARE
    table_name TEXT;
    application_tables CONSTANT TEXT[] := ARRAY[
        'roles', 'permissions', 'role_permissions', 'profiles',
        'user_permission_overrides', 'platform_access', 'books', 'chapters',
        'recordings', 'audio_recordings', 'public_library', 'activities',
        'activity_media', 'tasks', 'task_assignments', 'application_forms',
        'application_questions', 'volunteer_applications', 'application_answers',
        'gem_wallets', 'points_ledger', 'gem_transactions', 'certificates',
        'site_sections', 'site_settings', 'audit_logs', 'drive_files',
        'app_state', 'settings', 'members', 'users', 'departments',
        'cloud_folders', 'activity_logs', 'notifications'
    ];
BEGIN
    FOREACH table_name IN ARRAY application_tables LOOP
        IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
            EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', table_name);
            EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM anon, authenticated', table_name);
            EXECUTE format('GRANT ALL PRIVILEGES ON TABLE public.%I TO service_role', table_name);
        END IF;
    END LOOP;
END
$migration$;
