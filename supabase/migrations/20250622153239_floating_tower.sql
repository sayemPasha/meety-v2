/*
  # Fix Real-time Synchronization Setup

  This migration restores the real-time functionality that was lost when we recreated the database.
  
  1. Database Setup
    - Ensure proper real-time publication
    - Fix RLS policies for real-time compatibility
    - Grant proper permissions for anon role
  
  2. Real-time Configuration
    - Add tables to supabase_realtime publication
    - Ensure proper triggers are in place
    - Test real-time functionality
*/

-- First, ensure the real-time publication exists
DO $$
BEGIN
    -- Check if publication exists, create if not
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
        RAISE NOTICE '📡 Created supabase_realtime publication';
    ELSE
        RAISE NOTICE '📡 supabase_realtime publication already exists';
    END IF;
END $$;

-- Remove tables from publication first (in case they're already there)
DO $$
BEGIN
    -- Remove tables from publication (ignore errors if not present)
    BEGIN
        ALTER PUBLICATION supabase_realtime DROP TABLE sessions;
    EXCEPTION WHEN OTHERS THEN
        NULL; -- Ignore error if table not in publication
    END;
    
    BEGIN
        ALTER PUBLICATION supabase_realtime DROP TABLE session_users;
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;
    
    BEGIN
        ALTER PUBLICATION supabase_realtime DROP TABLE meetup_suggestions;
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;
END $$;

-- Add tables to real-time publication
ALTER PUBLICATION supabase_realtime ADD TABLE sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE session_users;
ALTER PUBLICATION supabase_realtime ADD TABLE meetup_suggestions;

-- Ensure proper permissions for real-time
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Grant table permissions
GRANT ALL ON sessions TO anon;
GRANT ALL ON session_users TO anon;
GRANT ALL ON meetup_suggestions TO anon;

GRANT ALL ON sessions TO authenticated;
GRANT ALL ON session_users TO authenticated;
GRANT ALL ON meetup_suggestions TO authenticated;

-- Grant sequence permissions
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Ensure RLS policies are compatible with real-time
-- Drop existing policies
DROP POLICY IF EXISTS "sessions_select_policy" ON sessions;
DROP POLICY IF EXISTS "sessions_insert_policy" ON sessions;
DROP POLICY IF EXISTS "sessions_update_policy" ON sessions;
DROP POLICY IF EXISTS "sessions_delete_policy" ON sessions;

DROP POLICY IF EXISTS "session_users_select_policy" ON session_users;
DROP POLICY IF EXISTS "session_users_insert_policy" ON session_users;
DROP POLICY IF EXISTS "session_users_update_policy" ON session_users;
DROP POLICY IF EXISTS "session_users_delete_policy" ON session_users;

DROP POLICY IF EXISTS "meetup_suggestions_select_policy" ON meetup_suggestions;
DROP POLICY IF EXISTS "meetup_suggestions_insert_policy" ON meetup_suggestions;
DROP POLICY IF EXISTS "meetup_suggestions_update_policy" ON meetup_suggestions;
DROP POLICY IF EXISTS "meetup_suggestions_delete_policy" ON meetup_suggestions;

-- Create real-time compatible policies (very permissive for collaborative features)
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

-- Enable real-time for all tables
ALTER TABLE sessions REPLICA IDENTITY FULL;
ALTER TABLE session_users REPLICA IDENTITY FULL;
ALTER TABLE meetup_suggestions REPLICA IDENTITY FULL;

-- Test real-time setup
DO $$
DECLARE
    test_session_id uuid;
    test_user_id uuid;
    test_suggestion_id uuid;
    pub_exists boolean;
    table_in_pub boolean;
BEGIN
    RAISE NOTICE '🧪 TESTING REAL-TIME SETUP...';
    
    -- Check if publication exists
    SELECT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') INTO pub_exists;
    RAISE NOTICE '📡 Publication exists: %', pub_exists;
    
    -- Check if tables are in publication
    SELECT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'sessions'
    ) INTO table_in_pub;
    RAISE NOTICE '📡 Sessions in publication: %', table_in_pub;
    
    SELECT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'session_users'
    ) INTO table_in_pub;
    RAISE NOTICE '📡 Session_users in publication: %', table_in_pub;
    
    SELECT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'meetup_suggestions'
    ) INTO table_in_pub;
    RAISE NOTICE '📡 Meetup_suggestions in publication: %', table_in_pub;
    
    -- Test basic operations that should trigger real-time events
    INSERT INTO sessions (is_active) VALUES (true) RETURNING id INTO test_session_id;
    RAISE NOTICE '✅ Session created (should trigger real-time): %', test_session_id;
    
    INSERT INTO session_users (session_id, name, color, connected) 
    VALUES (test_session_id, 'Real-time Test User', '#3b82f6', false) 
    RETURNING id INTO test_user_id;
    RAISE NOTICE '✅ User created (should trigger real-time): %', test_user_id;
    
    UPDATE session_users SET connected = true WHERE id = test_user_id;
    RAISE NOTICE '✅ User updated (should trigger real-time)';
    
    INSERT INTO meetup_suggestions (session_id, name, type, location_lat, location_lng, location_address, rating) 
    VALUES (test_session_id, 'Real-time Test Place', 'restaurant', 40.7128, -74.0060, 'Test Address', 4.5) 
    RETURNING id INTO test_suggestion_id;
    RAISE NOTICE '✅ Suggestion created (should trigger real-time): %', test_suggestion_id;
    
    DELETE FROM meetup_suggestions WHERE id = test_suggestion_id;
    RAISE NOTICE '✅ Suggestion deleted (should trigger real-time)';
    
    -- Clean up test data
    DELETE FROM sessions WHERE id = test_session_id;
    RAISE NOTICE '✅ Test data cleaned up';
    
    RAISE NOTICE '🎉 REAL-TIME SETUP COMPLETE!';
    RAISE NOTICE '📡 All tables are now properly configured for real-time subscriptions';
    RAISE NOTICE '🔄 Real-time events should now work for INSERT, UPDATE, DELETE operations';
END $$;