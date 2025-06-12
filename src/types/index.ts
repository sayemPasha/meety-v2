export interface User {
  id: string;
  name: string;
  location: {
    lat: number;
    lng: number;
    address: string;
  } | null;
  activity: string | null;
  connected: boolean;
  color: string;
}

export interface Session {
  id: string;
  createdAt: Date;
  users: User[];
  meetupSuggestions: MeetupSuggestion[];
}

export interface MeetupSuggestion {
  id: string;
  name: string;
  type: string;
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  rating: number;
  distance: number;
  averageDistance: number;
  placeId?: string;
  photoUrl?: string;
  priceLevel?: number;
  openNow?: boolean;
}

export interface ActivityType {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export const ACTIVITY_TYPES: ActivityType[] = [
  { id: 'restaurant', name: 'Restaurant', icon: '🍽️', color: '#f59e0b' },
  { id: 'outdoor', name: 'Outdoor Activity', icon: '🏞️', color: '#22c55e' },
  { id: 'sports', name: 'Sports', icon: '⚽', color: '#ef4444' },
  { id: 'entertainment', name: 'Entertainment', icon: '🎬', color: '#8b5cf6' },
  { id: 'shopping', name: 'Shopping', icon: '🛍️', color: '#ec4899' },
  { id: 'coffee', name: 'Coffee & Drinks', icon: '☕', color: '#a3531a' },
  { id: 'culture', name: 'Arts & Culture', icon: '🎨', color: '#0d9488' },
  { id: 'nightlife', name: 'Nightlife', icon: '🌃', color: '#7c3aed' }
];