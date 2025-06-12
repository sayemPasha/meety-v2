import type { User, MeetupSuggestion } from '@/types';

interface Location {
  lat: number;
  lng: number;
  address: string;
}

interface PlaceResult {
  name: string;
  type: string;
  location: Location;
  rating: number;
  place_id?: string;
}

// Calculate the geographic center (centroid) of all user locations
export function calculateCentroid(users: User[]): Location {
  const connectedUsers = users.filter(user => user.connected && user.location);
  
  if (connectedUsers.length === 0) {
    throw new Error('No connected users with locations');
  }

  let totalLat = 0;
  let totalLng = 0;

  connectedUsers.forEach(user => {
    if (user.location) {
      totalLat += user.location.lat;
      totalLng += user.location.lng;
    }
  });

  const centroidLat = totalLat / connectedUsers.length;
  const centroidLng = totalLng / connectedUsers.length;

  return {
    lat: centroidLat,
    lng: centroidLng,
    address: `${centroidLat.toFixed(4)}, ${centroidLng.toFixed(4)} (Center Point)`
  };
}

// Calculate distance between two points using Haversine formula
export function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

// Calculate average distance from a point to all users
export function calculateAverageDistance(location: Location, users: User[]): number {
  const connectedUsers = users.filter(user => user.connected && user.location);
  
  if (connectedUsers.length === 0) return 0;

  let totalDistance = 0;
  connectedUsers.forEach(user => {
    if (user.location) {
      totalDistance += calculateDistance(
        location.lat, 
        location.lng, 
        user.location.lat, 
        user.location.lng
      );
    }
  });

  return totalDistance / connectedUsers.length;
}

// Get the most preferred activity types from users
export function getPreferredActivityTypes(users: User[]): string[] {
  const connectedUsers = users.filter(user => user.connected && user.activity);
  const activityCounts: { [key: string]: number } = {};

  connectedUsers.forEach(user => {
    if (user.activity) {
      activityCounts[user.activity] = (activityCounts[user.activity] || 0) + 1;
    }
  });

  // Sort by frequency and return top activities
  return Object.entries(activityCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([activity]) => activity);
}

// Generate meetup suggestions based on user locations and preferences
export async function generateMeetupSuggestions(users: User[]): Promise<MeetupSuggestion[]> {
  const connectedUsers = users.filter(user => user.connected && user.location);
  
  if (connectedUsers.length < 2) {
    throw new Error('Need at least 2 connected users to generate suggestions');
  }

  // Calculate the centroid (optimal meeting point)
  const centroid = calculateCentroid(users);
  
  // Get preferred activity types
  const preferredActivities = getPreferredActivityTypes(users);
  
  // Generate suggestions around the centroid
  const suggestions: MeetupSuggestion[] = [];
  
  // Create suggestions for each preferred activity type
  for (const activityType of preferredActivities.slice(0, 3)) { // Top 3 activities
    const placesForActivity = await findPlacesNearLocation(centroid, activityType, users);
    suggestions.push(...placesForActivity);
  }

  // If we don't have enough suggestions, add some general ones
  if (suggestions.length < 3) {
    const generalPlaces = await findPlacesNearLocation(centroid, 'restaurant', users);
    suggestions.push(...generalPlaces.slice(0, 3 - suggestions.length));
  }

  // Sort by average distance (closest first) and rating
  return suggestions
    .sort((a, b) => {
      const distanceDiff = a.averageDistance - b.averageDistance;
      if (Math.abs(distanceDiff) < 0.5) { // If distances are similar, prefer higher rating
        return b.rating - a.rating;
      }
      return distanceDiff;
    })
    .slice(0, 5); // Return top 5 suggestions
}

// Mock function to find places near a location (in a real app, this would use Google Places API)
async function findPlacesNearLocation(
  location: Location, 
  activityType: string, 
  users: User[]
): Promise<MeetupSuggestion[]> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 200));

  // Mock places data based on activity type
  const mockPlaces = generateMockPlaces(location, activityType);
  
  // Calculate distances and create suggestions
  return mockPlaces.map(place => {
    const averageDistance = calculateAverageDistance(place.location, users);
    
    return {
      id: `${place.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
      name: place.name,
      type: activityType,
      location: place.location,
      rating: place.rating,
      distance: calculateDistance(
        location.lat, 
        location.lng, 
        place.location.lat, 
        place.location.lng
      ),
      averageDistance
    };
  });
}

// Generate mock places around a location
function generateMockPlaces(centerLocation: Location, activityType: string): PlaceResult[] {
  const placeTemplates = {
    restaurant: [
      'Central Bistro', 'The Meeting Place', 'Midpoint Café', 'Fusion Kitchen', 'Corner Table'
    ],
    outdoor: [
      'Central Park', 'Riverside Walk', 'Community Garden', 'Outdoor Plaza', 'Green Space'
    ],
    sports: [
      'Sports Bar & Grill', 'Game Zone', 'Athletic Club', 'Sports Lounge', 'Victory Pub'
    ],
    entertainment: [
      'Cinema Complex', 'Entertainment Center', 'Arcade Zone', 'Theater District', 'Fun Palace'
    ],
    shopping: [
      'Shopping Center', 'Market Square', 'Retail Plaza', 'Mall Central', 'Boutique District'
    ],
    coffee: [
      'Central Perk', 'Coffee Corner', 'Bean There', 'Brew Point', 'Café Central'
    ],
    culture: [
      'Art Gallery', 'Cultural Center', 'Museum Quarter', 'Heritage Hall', 'Creative Space'
    ],
    nightlife: [
      'Night Spot', 'Evening Lounge', 'After Hours', 'Night Scene', 'Late Night Café'
    ]
  };

  const templates = placeTemplates[activityType as keyof typeof placeTemplates] || placeTemplates.restaurant;
  
  return templates.slice(0, 3).map((name, index) => {
    // Generate locations within ~2km radius of center
    const radiusInDegrees = 0.018; // Approximately 2km
    const angle = (index * 120) * (Math.PI / 180); // Spread them out
    const distance = 0.005 + (Math.random() * radiusInDegrees);
    
    const lat = centerLocation.lat + (distance * Math.cos(angle));
    const lng = centerLocation.lng + (distance * Math.sin(angle));
    
    return {
      name,
      type: activityType,
      location: {
        lat,
        lng,
        address: `${name}, ${lat.toFixed(4)}, ${lng.toFixed(4)}`
      },
      rating: 3.5 + (Math.random() * 1.5) // Rating between 3.5 and 5.0
    };
  });
}

// Calculate the optimal meeting point using weighted centroid
export function calculateOptimalMeetingPoint(users: User[]): Location {
  const connectedUsers = users.filter(user => user.connected && user.location);
  
  if (connectedUsers.length === 0) {
    throw new Error('No connected users with locations');
  }

  // For now, use simple centroid. In advanced version, we could weight by:
  // - Travel time/distance preferences
  // - Transportation methods
  // - User priorities
  
  return calculateCentroid(users);
}

// Validate if a location is reasonable for all users
export function validateMeetingLocation(location: Location, users: User[], maxDistance: number = 50): boolean {
  const connectedUsers = users.filter(user => user.connected && user.location);
  
  return connectedUsers.every(user => {
    if (!user.location) return false;
    
    const distance = calculateDistance(
      location.lat,
      location.lng,
      user.location.lat,
      user.location.lng
    );
    
    return distance <= maxDistance;
  });
}