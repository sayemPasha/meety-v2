import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// Database types
export interface Database {
  public: {
    Tables: {
      sessions: {
        Row: {
          id: string;
          created_at: string;
          created_by: string | null;
          is_active: boolean;
        };
        Insert: {
          id?: string;
          created_at?: string;
          created_by?: string | null;
          is_active?: boolean;
        };
        Update: {
          id?: string;
          created_at?: string;
          created_by?: string | null;
          is_active?: boolean;
        };
      };
      session_users: {
        Row: {
          id: string;
          session_id: string;
          user_id: string | null;
          name: string;
          location_lat: number | null;
          location_lng: number | null;
          location_address: string | null;
          activity: string | null;
          connected: boolean;
          color: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          user_id?: string | null;
          name: string;
          location_lat?: number | null;
          location_lng?: number | null;
          location_address?: string | null;
          activity?: string | null;
          connected?: boolean;
          color: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          user_id?: string | null;
          name?: string;
          location_lat?: number | null;
          location_lng?: number | null;
          location_address?: string | null;
          activity?: string | null;
          connected?: boolean;
          color?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      meetup_suggestions: {
        Row: {
          id: string;
          session_id: string;
          name: string;
          type: string;
          location_lat: number;
          location_lng: number;
          location_address: string;
          rating: number;
          distance: number;
          average_distance: number;
          photo_url: string | null;
          place_id: string | null;
          price_level: number | null;
          open_now: boolean | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          name: string;
          type: string;
          location_lat: number;
          location_lng: number;
          location_address: string;
          rating?: number;
          distance?: number;
          average_distance?: number;
          photo_url?: string | null;
          place_id?: string | null;
          price_level?: number | null;
          open_now?: boolean | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          name?: string;
          type?: string;
          location_lat?: number;
          location_lng?: number;
          location_address?: string;
          rating?: number;
          distance?: number;
          average_distance?: number;
          photo_url?: string | null;
          place_id?: string | null;
          price_level?: number | null;
          open_now?: boolean | null;
          created_at?: string;
        };
      };
    };
  };
}