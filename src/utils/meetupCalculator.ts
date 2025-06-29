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

/**
 * Calculate the center point between multiple locations using simple average
 * @param locations Array of lat/lng objects
 * @returns The center point as lat/lng object
 */
export function calculateCenter(locations: Array<{ lat: number; lng: number }>) {
  if (locations.length === 0) {
    return null;
  }
  
  if (locations.length === 1) {
    return locations[0];
  }
  
  let totalLat = 0;
  let totalLng = 0;
  
  for (const location of locations) {
    totalLat += location.lat;
    totalLng += location.lng;
  }
  
  return {
    lat: totalLat / locations.length,
    lng: totalLng / locations.length,
  };
}

/**
 * Calculate the geographic centroid (true center point) of multiple locations
 * This uses proper geographic averaging, not separate median calculation
 * @param locations Array of lat/lng objects
 * @returns The geographic center point as lat/lng object
 */
export function calculateGeographicCentroid(locations: Array<{ lat: number; lng: number }>) {
  if (locations.length === 0) {
    return null;
  }
  
  if (locations.length === 1) {
    return locations[0];
  }
  
  // Convert to Cartesian coordinates for proper averaging
  let x = 0;
  let y = 0;
  let z = 0;
  
  for (const location of locations) {
    const latRad = location.lat * (Math.PI / 180);
    const lngRad = location.lng * (Math.PI / 180);
    
    x += Math.cos(latRad) * Math.cos(lngRad);
    y += Math.cos(latRad) * Math.sin(lngRad);
    z += Math.sin(latRad);
  }
  
  // Average the coordinates
  x = x / locations.length;
  y = y / locations.length;
  z = z / locations.length;
  
  // Convert back to lat/lng
  const centralLng = Math.atan2(y, x);
  const centralSquareRoot = Math.sqrt(x * x + y * y);
  const centralLat = Math.atan2(z, centralSquareRoot);
  
  return {
    lat: centralLat * (180 / Math.PI),
    lng: centralLng * (180 / Math.PI),
  };
}

/**
 * Calculate the median point between multiple locations
 * This finds the true geographic median - the point that minimizes total distance to all points
 * @param locations Array of lat/lng objects
 * @returns The median point as lat/lng object
 */
export function calculateMedianPoint(locations: Array<{ lat: number; lng: number }>) {
  if (locations.length === 0) {
    return null;
  }
  
  if (locations.length === 1) {
    return locations[0];
  }
  
  // For 2 points, median is the midpoint
  if (locations.length === 2) {
    return {
      lat: (locations[0].lat + locations[1].lat) / 2,
      lng: (locations[0].lng + locations[1].lng) / 2,
    };
  }
  
  // For multiple points, use coordinate-wise median
  // This is more robust against outliers than centroid calculation
  const lats = locations.map(loc => loc.lat).sort((a, b) => a - b);
  const lngs = locations.map(loc => loc.lng).sort((a, b) => a - b);
  
  let medianLat, medianLng;
  const mid = Math.floor(locations.length / 2);
  
  if (locations.length % 2 === 0) {
    // Even number of points - average the two middle values
    medianLat = (lats[mid - 1] + lats[mid]) / 2;
    medianLng = (lngs[mid - 1] + lngs[mid]) / 2;
  } else {
    // Odd number of points - take the middle value
    medianLat = lats[mid];
    medianLng = lngs[mid];
  }
  
  return {
    lat: medianLat,
    lng: medianLng,
  };
}

// Calculate the geographic center - UPDATED to handle single user
export function calculateCentroid(users: User[]): Location {
  const connectedUsers = users.filter(user => user.connected && user.location);
  
  if (connectedUsers.length === 0) {
    throw new Error('No connected users with locations');
  }

  console.log('🧮 Calculating center point for users:', connectedUsers.map(u => ({
    name: u.name,
    location: u.location
  })));

  // Extract locations for calculation
  const locations = connectedUsers.map(user => ({
    lat: user.location!.lat,
    lng: user.location!.lng
  }));

  console.log('📍 Input locations for center calculation:', locations);

  let centerPoint;
  
  if (locations.length === 1) {
    // For single user, center point is their location
    centerPoint = locations[0];
    console.log('👤 Single user mode: Using user location as center point');
  } else {
    // For multiple users, use MEDIAN POINT calculation - more robust against outliers
    centerPoint = calculateMedianPoint(locations);
    console.log('👥 Multi-user mode: Using median point calculation');
  }
  
  if (!centerPoint) {
    throw new Error('Could not calculate center point');
  }

  console.log('🎯 Calculated center point:', centerPoint);

  return {
    lat: centerPoint.lat,
    lng: centerPoint.lng,
    address: `${centerPoint.lat.toFixed(6)}, ${centerPoint.lng.toFixed(6)} (${locations.length === 1 ? 'User Location' : 'Median Center Point'})`
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

// Generate meetup suggestions - UPDATED to handle single user and accept maxResults parameter
export async function generateMeetupSuggestions(users: User[], maxResults: number = 7): Promise<MeetupSuggestion[]> {
  const connectedUsers = users.filter(user => user.connected && user.location);
  
  if (connectedUsers.length < 1) {
    throw new Error('Need at least 1 connected user to generate suggestions');
  }

  console.log('🎯 Generating meetup suggestions for users:', connectedUsers.map(u => ({
    name: u.name,
    location: u.location,
    activity: u.activity
  })));

  // Calculate the center point (user location for single user, median for multiple)
  const centerPoint = calculateCentroid(users);
  console.log('📍 Calculated center point:', centerPoint);
  
  // Get preferred activity types
  const preferredActivities = getPreferredActivityTypes(users);
  console.log('🎨 Preferred activities:', preferredActivities);
  
  const allSuggestions: MeetupSuggestion[] = [];
  
  // Use Google Places API if available, otherwise fallback to mock data
  if (window.google && window.google.maps && window.google.maps.places) {
    try {
      const placesService = new google.maps.places.PlacesService(
        document.createElement('div')
      );
      
      // Calculate suggestions per activity type based on maxResults
      const suggestionsPerActivity = Math.ceil(maxResults / Math.max(preferredActivities.length + 2, 4)); // +2 for restaurant and cafe fallbacks
      
      // Search for places for each preferred activity type
      for (const activityType of preferredActivities.slice(0, 4)) {
        const placesForActivity = await searchGooglePlaces(
          placesService, 
          centerPoint, 
          getGooglePlacesType(activityType),
          activityType,
          users,
          suggestionsPerActivity
        );
        allSuggestions.push(...placesForActivity);
      }
      
      // Always add restaurants as they're most common meetup spots
      if (!preferredActivities.includes('restaurant')) {
        const restaurantPlaces = await searchGooglePlaces(
          placesService,
          centerPoint,
          'restaurant',
          'restaurant',
          users,
          suggestionsPerActivity * 2 // More restaurants
        );
        allSuggestions.push(...restaurantPlaces);
      }
      
      // Add cafes as backup option
      if (!preferredActivities.includes('coffee')) {
        const cafePlaces = await searchGooglePlaces(
          placesService,
          centerPoint,
          'cafe',
          'coffee',
          users,
          suggestionsPerActivity
        );
        allSuggestions.push(...cafePlaces);
      }
    } catch (error) {
      console.error('Google Places API error, falling back to mock data:', error);
      return generateMockSuggestions(users, centerPoint, preferredActivities, maxResults);
    }
  } else {
    console.log('Google Places API not available, using mock data');
    return generateMockSuggestions(users, centerPoint, preferredActivities, maxResults);
  }

  // Remove duplicates based on place ID or name+location
  const uniqueSuggestions = removeDuplicateSuggestions(allSuggestions);

  // Sort by distance to center point FIRST (closest first), then by rating
  const sortedSuggestions = uniqueSuggestions
    .sort((a, b) => {
      // Primary sort: distance to center point (closest first)
      const distanceToCenter_A = calculateDistance(
        centerPoint.lat, centerPoint.lng,
        a.location.lat, a.location.lng
      );
      const distanceToCenter_B = calculateDistance(
        centerPoint.lat, centerPoint.lng,
        b.location.lat, b.location.lng
      );
      
      const centerDistanceDiff = distanceToCenter_A - distanceToCenter_B;
      
      // If distances to center are very similar (within 500m), prefer higher rating
      if (Math.abs(centerDistanceDiff) < 0.5) {
        return b.rating - a.rating;
      }
      
      return centerDistanceDiff;
    })
    .slice(0, maxResults); // Return requested number of suggestions

  console.log('✨ Final suggestions (sorted by distance to center):', sortedSuggestions.map(s => ({
    name: s.name,
    distanceToCenter: calculateDistance(centerPoint.lat, centerPoint.lng, s.location.lat, s.location.lng).toFixed(2) + 'km',
    avgDistance: s.averageDistance.toFixed(2) + 'km',
    rating: s.rating,
    hasPhoto: !!s.photoUrl
  })));
  
  return sortedSuggestions;
}

// Remove duplicate suggestions
function removeDuplicateSuggestions(suggestions: MeetupSuggestion[]): MeetupSuggestion[] {
  const seen = new Set<string>();
  const unique: MeetupSuggestion[] = [];
  
  for (const suggestion of suggestions) {
    // Create a unique key based on place ID or name+coordinates
    const key = suggestion.placeId || 
                `${suggestion.name.toLowerCase()}-${suggestion.location.lat.toFixed(4)}-${suggestion.location.lng.toFixed(4)}`;
    
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(suggestion);
    }
  }
  
  return unique;
}

// Search Google Places API - ENHANCED with better photo retrieval
function searchGooglePlaces(
  placesService: google.maps.places.PlacesService,
  location: Location,
  placeType: string,
  activityType: string,
  users: User[],
  maxResults: number = 10
): Promise<MeetupSuggestion[]> {
  return new Promise((resolve) => {
    const request: google.maps.places.PlaceSearchRequest = {
      location: new google.maps.LatLng(location.lat, location.lng),
      radius: 3000, // 3km radius for suggestions
      type: placeType as any,
      openNow: false
    };

    console.log(`🔍 Searching Google Places for ${placeType} near ${location.lat}, ${location.lng}`);

    placesService.nearbySearch(request, (results, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && results) {
        console.log(`✅ Found ${results.length} places for ${placeType}`);
        
        const suggestions = results
          .slice(0, maxResults)
          .filter(place => place.rating && place.rating >= 3.0)
          .map(place => {
            const placeLocation = {
              lat: place.geometry?.location?.lat() || location.lat,
              lng: place.geometry?.location?.lng() || location.lng,
              address: place.vicinity || place.formatted_address || 'Unknown address'
            };

            const averageDistance = calculateAverageDistance(placeLocation, users);
            const distanceToCenter = calculateDistance(
              location.lat,
              location.lng,
              placeLocation.lat,
              placeLocation.lng
            );
            
            // Get photo URL if available - ENHANCED
            let photoUrl = '';
            if (place.photos && place.photos.length > 0) {
              try {
                photoUrl = place.photos[0].getUrl({ 
                  maxWidth: 400, 
                  maxHeight: 300 
                });
                console.log(`📸 Retrieved photo for ${place.name}: ${photoUrl.substring(0, 50)}...`);
              } catch (error) {
                console.warn(`⚠️ Failed to get photo for ${place.name}:`, error);
              }
            } else {
              console.log(`📷 No photos available for ${place.name}`);
            }

            const suggestion = {
              id: place.place_id || `${place.name?.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
              name: place.name || 'Unknown Place',
              type: activityType,
              location: placeLocation,
              rating: place.rating || 4.0,
              distance: distanceToCenter,
              averageDistance,
              placeId: place.place_id,
              photoUrl: photoUrl || undefined,
              priceLevel: place.price_level,
              openNow: place.opening_hours?.open_now
            };

            console.log(`📍 Created suggestion: ${suggestion.name} (${suggestion.rating}⭐, ${suggestion.distance.toFixed(1)}km, photo: ${!!suggestion.photoUrl})`);
            
            return suggestion;
          });
        
        resolve(suggestions);
      } else {
        console.error(`❌ Places search failed for ${placeType}:`, status);
        resolve([]);
      }
    });
  });
}

// Fallback mock suggestions when Google Places API is not available - UPDATED for single user and maxResults
function generateMockSuggestions(
  users: User[], 
  centerPoint: Location, 
  preferredActivities: string[],
  maxResults: number = 7
): MeetupSuggestion[] {
  console.log('🎭 Generating mock suggestions (Google Places API not available)');
  
  const suggestions: MeetupSuggestion[] = [];
  const suggestionsPerActivity = Math.ceil(maxResults / Math.max(preferredActivities.length + 2, 4));
  
  // Create suggestions for each preferred activity type
  for (const activityType of preferredActivities.slice(0, 3)) {
    const placesForActivity = generateMockPlaces(centerPoint, activityType, users, suggestionsPerActivity);
    suggestions.push(...placesForActivity);
  }

  // Always add restaurants
  if (!preferredActivities.includes('restaurant')) {
    const restaurantPlaces = generateMockPlaces(centerPoint, 'restaurant', users, suggestionsPerActivity * 2);
    suggestions.push(...restaurantPlaces);
  }

  // Add cafes
  if (!preferredActivities.includes('coffee')) {
    const cafePlaces = generateMockPlaces(centerPoint, 'coffee', users, suggestionsPerActivity);
    suggestions.push(...cafePlaces);
  }

  // Sort by distance to center point (closest first)
  return suggestions
    .sort((a, b) => {
      const distanceToCenter_A = calculateDistance(
        centerPoint.lat, centerPoint.lng,
        a.location.lat, a.location.lng
      );
      const distanceToCenter_B = calculateDistance(
        centerPoint.lat, centerPoint.lng,
        b.location.lat, b.location.lng
      );
      
      const centerDistanceDiff = distanceToCenter_A - distanceToCenter_B;
      
      // If distances are similar, prefer higher rating
      if (Math.abs(centerDistanceDiff) < 0.5) {
        return b.rating - a.rating;
      }
      
      return centerDistanceDiff;
    })
    .slice(0, maxResults); // Return requested number of suggestions
}

// Generate mock places around a location
function generateMockPlaces(centerLocation: Location, activityType: string, users: User[], count: number = 3): MeetupSuggestion[] {
  const placeTemplates = {
    restaurant: [
      'Central Bistro', 'The Meeting Place', 'Midpoint Café', 'Fusion Kitchen', 'Corner Table',
      'Downtown Diner', 'City Grill', 'Metro Restaurant', 'Urban Eatery', 'Plaza Kitchen',
      'Riverside Bistro', 'Garden Restaurant', 'Skyline Diner', 'Harbor Grill', 'Summit Café'
    ],
    outdoor: [
      'Central Park', 'Riverside Walk', 'Community Garden', 'Outdoor Plaza', 'Green Space',
      'City Park', 'Nature Trail', 'Public Garden', 'Waterfront Park', 'Recreation Area',
      'Botanical Garden', 'Lakeside Park', 'Mountain View Trail', 'Sunset Point', 'Forest Walk'
    ],
    sports: [
      'Sports Bar & Grill', 'Game Zone', 'Athletic Club', 'Sports Lounge', 'Victory Pub',
      'Champions Bar', 'Stadium Grill', 'Sports Center', 'Active Zone', 'Fitness Hub',
      'Arena Sports Bar', 'Playoff Lounge', 'Court Side Café', 'Field House', 'Training Ground'
    ],
    entertainment: [
      'Cinema Complex', 'Entertainment Center', 'Arcade Zone', 'Theater District', 'Fun Palace',
      'Movie Theater', 'Gaming Lounge', 'Entertainment Hub', 'Activity Center', 'Amusement Zone',
      'Comedy Club', 'Live Music Venue', 'Performance Hall', 'Arts Theater', 'Concert Hall'
    ],
    shopping: [
      'Shopping Center', 'Market Square', 'Retail Plaza', 'Mall Central', 'Boutique District',
      'Shopping Mall', 'Retail Hub', 'Market Place', 'Commercial Center', 'Shopping District',
      'Fashion Plaza', 'Trade Center', 'Outlet Mall', 'Artisan Market', 'Designer District'
    ],
    coffee: [
      'Central Perk', 'Coffee Corner', 'Bean There', 'Brew Point', 'Café Central',
      'Coffee House', 'Espresso Bar', 'Café Metro', 'Coffee Station', 'Brew & Bean',
      'Roastery Café', 'Morning Grind', 'Latte Lounge', 'Caffeine Corner', 'Steam & Bean'
    ],
    culture: [
      'Art Gallery', 'Cultural Center', 'Museum Quarter', 'Heritage Hall', 'Creative Space',
      'Art Museum', 'Cultural Hub', 'Gallery District', 'Arts Center', 'Creative Quarter',
      'History Museum', 'Science Center', 'Modern Art Gallery', 'Cultural Institute', 'Exhibition Hall'
    ],
    nightlife: [
      'Night Spot', 'Evening Lounge', 'After Hours', 'Night Scene', 'Late Night Café',
      'Night Club', 'Cocktail Bar', 'Evening Bar', 'Night Lounge', 'After Dark',
      'Rooftop Bar', 'Jazz Club', 'Wine Bar', 'Speakeasy', 'Dance Club'
    ]
  };

  const templates = placeTemplates[activityType as keyof typeof placeTemplates] || placeTemplates.restaurant;
  
  return templates.slice(0, count).map((name, index) => {
    // Generate locations closer to center (within ~1-3km radius)
    const radiusInDegrees = 0.005 + (Math.random() * 0.020); // 0.5km to 2.5km radius
    const angle = (index * (360 / count) + Math.random() * 60) * (Math.PI / 180); // Spread them out with some randomness
    
    const lat = centerLocation.lat + (radiusInDegrees * Math.cos(angle));
    const lng = centerLocation.lng + (radiusInDegrees * Math.sin(angle));
    
    const location = {
      lat,
      lng,
      address: `${name}, ${lat.toFixed(4)}, ${lng.toFixed(4)}`
    };

    const averageDistance = calculateAverageDistance(location, users);
    const distanceToCenter = calculateDistance(
      centerLocation.lat,
      centerLocation.lng,
      lat,
      lng
    );
    
    return {
      id: `${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}-${index}`,
      name,
      type: activityType,
      location,
      rating: 3.8 + (Math.random() * 1.2), // Rating between 3.8 and 5.0
      distance: distanceToCenter,
      averageDistance
    };
  });
}

// Calculate the optimal meeting point - UPDATED to handle single user
export function calculateOptimalMeetingPoint(users: User[]): Location {
  const connectedUsers = users.filter(user => user.connected && user.location);
  
  if (connectedUsers.length === 0) {
    throw new Error('No connected users with locations');
  }

  // Use center calculation (handles both single and multiple users)
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