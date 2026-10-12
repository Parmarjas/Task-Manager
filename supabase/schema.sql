-- ==============================================================================
-- TASK MANAGEMENT APPLICATION - SUPABASE DATABASE SCHEMA
-- ==============================================================================
-- This script sets up:
-- 1. `profiles` table: Tracks user metadata (name, email, avatar).
-- 2. `tasks` table: Core task entity with foreign keys to creator & assignee.
-- 3. Automatic timestamps update trigger.
-- 4. Automatic user profile creation trigger on Google OAuth signup.
-- 5. Row Level Security (RLS) policies for secure data access.
-- ==============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. PROFILES TABLE
-- ------------------------------------------------------------------------------
-- Mirrors the auth.users table so we can query users, display assignment options,
-- and look up email addresses when sending assignment notifications.
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ------------------------------------------------------------------------------
-- 2. TASKS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'completed')),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    due_date TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for performance on frequently queried columns
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON public.tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);

-- ------------------------------------------------------------------------------
-- 3. AUTOMATIC UPDATED_AT TRIGGER
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_tasks_updated_at ON public.tasks;
CREATE TRIGGER set_tasks_updated_at
    BEFORE UPDATE ON public.tasks
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 4. AUTO-SYNC GOOGLE OAUTH USERS TO PROFILES
-- ------------------------------------------------------------------------------
-- When a user logs in via Google OAuth, Supabase automatically inserts a record
-- into auth.users. This trigger copies their email, name, and avatar to public.profiles.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', '')
    )
    ON CONFLICT (id) DO UPDATE
    SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        avatar_url = EXCLUDED.avatar_url,
        updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT OR UPDATE ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view all profiles (needed so users can assign tasks to teammates)
CREATE POLICY "Allow authenticated users to read all profiles"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (true);

-- Allow users to update their own profile
CREATE POLICY "Allow individual users to update own profile"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = id);

-- Allow authenticated users to see tasks where they are the creator OR the assignee
CREATE POLICY "Allow users to view created or assigned tasks"
    ON public.tasks
    FOR SELECT
    TO authenticated
    USING (auth.uid() = created_by OR auth.uid() = assigned_to);

-- Allow authenticated users to create tasks
CREATE POLICY "Allow authenticated users to insert tasks"
    ON public.tasks
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = created_by);

-- Allow creator or assignee to update tasks (e.g., mark complete or reassign)
CREATE POLICY "Allow creator or assignee to update tasks"
    ON public.tasks
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = created_by OR auth.uid() = assigned_to);

-- Allow creator to delete tasks
CREATE POLICY "Allow creator to delete tasks"
    ON public.tasks
    FOR DELETE
    TO authenticated
    USING (auth.uid() = created_by);
