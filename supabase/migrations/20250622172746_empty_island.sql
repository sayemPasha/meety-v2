/*
  # Add photo and place details fields to meetup suggestions

  1. New Columns
    - `photo_url` (text) - URL for place photo from Google Places API
    - `place_id` (text) - Google Places place ID for detailed information
    - `price_level` (integer) - Price level from Google Places (1-4)
    - `open_now` (boolean) - Whether the place is currently open

  2. Purpose
    - Store rich place information from Google Places API
    - Enable better UI with photos and detailed information
    - Support real-time open/closed status
*/

DO $$
BEGIN
  -- Add photo_url column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meetup_suggestions' AND column_name = 'photo_url'
  ) THEN
    ALTER TABLE meetup_suggestions ADD COLUMN photo_url text;
  END IF;

  -- Add place_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meetup_suggestions' AND column_name = 'place_id'
  ) THEN
    ALTER TABLE meetup_suggestions ADD COLUMN place_id text;
  END IF;

  -- Add price_level column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meetup_suggestions' AND column_name = 'price_level'
  ) THEN
    ALTER TABLE meetup_suggestions ADD COLUMN price_level integer;
  END IF;

  -- Add open_now column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meetup_suggestions' AND column_name = 'open_now'
  ) THEN
    ALTER TABLE meetup_suggestions ADD COLUMN open_now boolean;
  END IF;
END $$;