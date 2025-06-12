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
  photo_url?: string;
  price_level?: number;
  opening_hours?: {
    open_now?: boolean;
  };
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

// Convert activity type to Google Places type
function getGooglePlacesType(activityType: string): string {
  const typeMapping: { [key: string]: string } = {
    restaurant: 'restaurant',
    outdoor: 'park',
    sports: 'gym',
    entertainment: 'movie_theater',
    shopping: 'shopping_mall',
    coffee: 'cafe',
    culture: 'museum',
    nightlife: 'night_club'
  };
  
  return typeMapping[activityType] || 'restaurant';
}

// Generate meetup suggestions using Google Places API
export async function generateMeetupSuggestions(users: User[]): Promise<MeetupSuggestion[]> {
  const connectedUsers = users.filter(user => user.connected && user.location);
  
  if (connectedUsers.length < 2) {
    throw new Error('Need at least 2 connected users to generate suggestions');
  }

  console.log('🎯 Generating meetup suggestions for users:', connectedUsers.map(u => ({
    name: u.name,
    location: u.location,
    activity: u.activity
  })));

  // Calculate the centroid (optimal meeting point)
  const centroid = calculateCentroid(users);
  console.log('📍 Calculated centroid:', centroid);
  
  // Get preferred activity types
  const preferredActivities = getPreferredActivityTypes(users);
  console.log('🎨 Preferred activities:', preferredActivities);
  
  const suggestions: MeetupSuggestion[] = [];
  
  // Use Google Places API if available, otherwise fallback to mock data
  if (window.google && window.google.maps && window.google.maps.places) {
    try {
      const placesService = new google.maps.places.PlacesService(
        document.createElement('div')
      );
      
      // Search for places for each preferred activity type
      for (const activityType of preferredActivities.slice(0, 3)) {
        const placesForActivity = await searchGooglePlaces(
          placesService, 
          centroid, 
          getGooglePlacesType(activityType),
          activityType,
          users
        );
        suggestions.push(...placesForActivity);
      }
      
      // If we don't have enough suggestions, add restaurants as fallback
      if (suggestions.length < 3) {
        const restaurantPlaces = await searchGooglePlaces(
          placesService,
          centroid,
          'restaurant',
          'restaurant',
          users
        );
        suggestions.push(...restaurantPlaces.slice(0, 3 - suggestions.length));
      }
    } catch (error) {
      console.error('Google Places API error, falling back to mock data:', error);
      return generateMockSuggestions(users, centroid, preferredActivities);
    }
  } else {
    console.log('Google Places API not available, using mock data');
    return generateMockSuggestions(users, centroid, preferredActivities);
  }

  // Sort by average distance (closest first) and rating
  const sortedSuggestions = suggestions
    .sort((a, b) => {
      const distanceDiff = a.averageDistance - b.averageDistance;
      if (Math.abs(distanceDiff) < 0.5) { // If distances are similar, prefer higher rating
        return b.rating - a.rating;
      }
      return distanceDiff;
    })
    .slice(0, 5); // Return top 5 suggestions

  console.log('✨ Final suggestions:', sortedSuggestions);
  return sortedSuggestions;
}

// Search Google Places API
function searchGooglePlaces(
  placesService: google.maps.places.PlacesService,
  location: Location,
  placeType: string,
  activityType: string,
  users: User[]
): Promise<MeetupSuggestion[]> {
  return new Promise((resolve) => {
    const request: google.maps.places.PlaceSearchRequest = {
      location: new google.maps.LatLng(location.lat, location.lng),
      radius: 5000, // 5km radius
      type: placeType as any,
      openNow: false
    };

    placesService.nearbySearch(request, (results, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && results) {
        const suggestions = results.slice(0, 3).map(place => {
          const placeLocation = {
            lat: place.geometry?.location?.lat() || location.lat,
            lng: place.geometry?.location?.lng() || location.lng,
            address: place.vicinity || place.formatted_address || 'Unknown address'
          };

          const averageDistance = calculateAverageDistance(placeLocation, users);
          
          // Get photo URL if available
          let photoUrl = '';
          if (place.photos && place.photos.length > 0) {
            photoUrl = place.photos[0].getUrl({ maxWidth: 400, maxHeight: 300 });
          }

          return {
            id: place.place_id || `${place.name?.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
            name: place.name || 'Unknown Place',
            type: activityType,
            location: placeLocation,
            rating: place.rating || 4.0,
            distance: calculateDistance(
              location.lat,
              location.lng,
              placeLocation.lat,
              placeLocation.lng
            ),
            averageDistance,
            placeId: place.place_id,
            photoUrl,
            priceLevel: place.price_level,
            openNow: place.opening_hours?.open_now
          };
        });
        
        resolve(suggestions);
      } else {
        console.error('Places search failed:', status);
        resolve([]);
      }
    });
  });
}

// Fallback mock suggestions when Google Places API is not available
function generateMockSuggestions(
  users: User[], 
  centroid: Location, 
  preferredActivities: string[]
): MeetupSuggestion[] {
  const suggestions: MeetupSuggestion[] = [];
  
  // Create suggestions for each preferred activity type
  for (const activityType of preferredActivities.slice(0, 3)) {
    const placesForActivity = generateMockPlaces(centroid, activityType, users);
    suggestions.push(...placesForActivity);
  }

  // If we don't have enough suggestions, add some general ones
  if (suggestions.length < 3) {
    const generalPlaces = generateMockPlaces(centroid, 'restaurant', users);
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

// Generate mock places around a location
function generateMockPlaces(centerLocation: Location, activityType: string, users: User[]): MeetupSuggestion[] {
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
    
    const location = {
      lat,
      lng,
      address: `${name}, ${lat.toFixed(4)}, ${lng.toFixed(4)}`
    };

    const averageDistance = calculateAverageDistance(location, users);
    
    return {
      id: `${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}-${index}`,
      name,
      type: activityType,
      location,
      rating: 3.5 + (Math.random() * 1.5), // Rating between 3.5 and 5.0
      distance: calculateDistance(
        centerLocation.lat,
        centerLocation.lng,
        lat,
        lng
      ),
      averageDistance
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