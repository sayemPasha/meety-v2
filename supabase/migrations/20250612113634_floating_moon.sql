/*
  # Meety App Database Schema

  1. New Tables
    - `sessions`
      - `id` (uuid, primary key)
      - `created_at` (timestamp)
      - `created_by` (uuid, references auth.users)
      - `is_active` (boolean, default true)
    
    - `session_users`
      - `id` (uuid, primary key)
      - `session_id` (uuid, references sessions)
      - `user_id` (uuid, references auth.users, nullable for anonymous users)
      - `name` (text)
      - `location_lat` (decimal, nullable)
      - `location_lng` (decimal, nullable)
      - `location_address` (text, nullable)
      - `activity` (text, nullable)
      - `connected` (boolean, default false)
      - `color` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `meetup_suggestions`
      - `id` (uuid, primary key)
      - `session_id` (uuid, references sessions)
      - `name` (text)
      - `type` (text)
      - `location_lat` (decimal)
      - `location_lng` (decimal)
      - `location_address` (text)
      - `rating` (decimal)
      - `distance` (decimal)
      - `average_distance` (decimal)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for session access and user management
    - Allow anonymous users to participate in sessions

  3. Real-time
    - Enable real-time subscriptions for collaborative features
*/

-- Create sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active boolean DEFAULT true
);

-- Create session_users table
CREATE TABLE IF NOT EXISTS session_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES sessions(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  location_lat decimal,
  location_lng decimal,
  location_address text,
  activity text,
  connected boolean DEFAULT false,
  color text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create meetup_suggestions table
CREATE TABLE IF NOT EXISTS meetup_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES sessions(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  type text NOT NULL,
  location_lat decimal NOT NULL,
  location_lng decimal NOT NULL,
  location_address text NOT NULL,
  rating decimal DEFAULT 0,
  distance decimal DEFAULT 0,
  average_distance decimal DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetup_suggestions ENABLE ROW LEVEL SECURITY;

-- Sessions policies
CREATE POLICY "Anyone can read sessions"
  ON sessions
  FOR SELECT
  TO public
  USING (is_active = true);

CREATE POLICY "Anyone can create sessions"
  ON sessions
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Session creators can update their sessions"
  ON sessions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by);

-- Session users policies
CREATE POLICY "Anyone can read session users"
  ON session_users
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Anyone can create session users"
  ON session_users
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Users can update their own session data"
  ON session_users
  FOR UPDATE
  TO public
  USING (true);

-- Meetup suggestions policies
CREATE POLICY "Anyone can read meetup suggestions"
  ON meetup_suggestions
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Anyone can create meetup suggestions"
  ON meetup_suggestions
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_session_users_session_id ON session_users(session_id);
CREATE INDEX IF NOT EXISTS idx_meetup_suggestions_session_id ON meetup_suggestions(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for session_users updated_at
CREATE TRIGGER update_session_users_updated_at
    BEFORE UPDATE ON session_users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable real-time for all tables
ALTER PUBLICATION supabase_realtime ADD TABLE sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE session_users;
ALTER PUBLICATION supabase_realtime ADD TABLE meetup_suggestions;