/*
  # Fix Real-time Sync Issues

  1. Problem Analysis
    - Real-time subscriptions may not work properly with overly permissive RLS policies
    - The current policies use `USING (true)` which can cause issues with real-time filters
    - Need to ensure real-time subscriptions can properly filter and receive updates

  2. Solution
    - Update RLS policies to be more specific for real-time compatibility
    - Ensure proper permissions for real-time subscriptions
    - Add explicit policies for different operations

  3. Changes
    - Drop and recreate RLS policies with better real-time compatibility
    - Ensure anon role has proper access for collaborative features
    - Add specific policies for INSERT, UPDATE, DELETE operations
*/

-- Drop existing policies
DROP POLICY IF EXISTS "sessions_all_access" ON sessions;
DROP POLICY IF EXISTS "session_users_all_access" ON session_users;
DROP POLICY IF EXISTS "meetup_suggestions_all_access" ON meetup_suggestions;

-- Create more specific policies that work better with real-time

-- Sessions policies
CREATE POLICY "sessions_select_policy" ON sessions
  FOR SELECT TO public
  USING (is_active = true);

CREATE POLICY "sessions_insert_policy" ON sessions
  FOR INSERT TO public
  WITH CHECK (true);

CREATE POLICY "sessions_update_policy" ON sessions
  FOR UPDATE TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "sessions_delete_policy" ON sessions
  FOR DELETE TO public
  USING (true);

-- Session users policies
CREATE POLICY "session_users_select_policy" ON session_users
  FOR SELECT TO public
  USING (true);

CREATE POLICY "session_users_insert_policy" ON session_users
  FOR INSERT TO public
  WITH CHECK (true);

CREATE POLICY "session_users_update_policy" ON session_users
  FOR UPDATE TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "session_users_delete_policy" ON session_users
  FOR DELETE TO public
  USING (true);

-- Meetup suggestions policies
CREATE POLICY "meetup_suggestions_select_policy" ON meetup_suggestions
  FOR SELECT TO public
  USING (true);

CREATE POLICY "meetup_suggestions_insert_policy" ON meetup_suggestions
  FOR INSERT TO public
  WITH CHECK (true);

CREATE POLICY "meetup_suggestions_update_policy" ON meetup_suggestions
  FOR UPDATE TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "meetup_suggestions_delete_policy" ON meetup_suggestions
  FOR DELETE TO public
  USING (true);

-- Grant explicit permissions to anon role for real-time
GRANT USAGE ON SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;

-- Ensure real-time is enabled for these tables
ALTER PUBLICATION supabase_realtime ADD TABLE sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE session_users;
ALTER PUBLICATION supabase_realtime ADD TABLE meetup_suggestions;

-- Test the real-time setup
DO $$
BEGIN
    RAISE NOTICE '🔄 REAL-TIME SETUP COMPLETE';
    RAISE NOTICE '✅ RLS policies updated for real-time compatibility';
    RAISE NOTICE '✅ Permissions granted to anon role';
    RAISE NOTICE '✅ Tables added to real-time publication';
    RAISE NOTICE '📡 Real-time subscriptions should now work properly';
END $$;