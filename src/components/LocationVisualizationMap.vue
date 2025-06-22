<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
    <div class="bg-white rounded-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
      <div class="p-6 border-b border-gray-200">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-2xl font-bold text-gray-800 mb-2">🗺️ Location Visualization</h2>
            <p class="text-gray-600">User locations and suggested meetup spots</p>
          </div>
          <button
            class="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
            @click="$emit('close')"
          >
            <span class="text-gray-600">✕</span>
          </button>
        </div>
      </div>
      
      <div class="flex flex-col lg:flex-row h-[70vh]">
        <!-- Map Container -->
        <div class="flex-1 relative">
          <div 
            ref="mapContainer" 
            class="w-full h-full min-h-[400px]"
          ></div>

          <!-- Statistics Panel -->
          <div class="absolute bottom-4 left-4 bg-white rounded-xl p-4 shadow-lg border border-gray-200 z-10 max-w-sm">
            <h3 class="font-semibold text-gray-800 mb-3">Distance Analysis</h3>
            <div class="space-y-2 text-sm">
              <div v-if="centerPoint">
                <div class="font-medium text-gray-700">Median Center Point:</div>
                <div class="text-gray-600">{{ centerPoint.lat.toFixed(6) }}, {{ centerPoint.lng.toFixed(6) }}</div>
              </div>
              <div v-if="averageDistanceToCenter >= 0">
                <div class="font-medium text-gray-700">Avg Distance to Center:</div>
                <div class="text-gray-600">{{ averageDistanceToCenter.toFixed(2) }} km</div>
              </div>
              <div v-if="maxDistanceToCenter >= 0">
                <div class="font-medium text-gray-700">Max Distance to Center:</div>
                <div class="text-gray-600">{{ maxDistanceToCenter.toFixed(2) }} km</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Info Panel -->
        <div class="lg:w-80 p-6 border-t lg:border-t-0 lg:border-l border-gray-200 bg-gray-50 overflow-y-auto">
          <!-- User Locations -->
          <div class="mb-6">
            <h3 class="text-lg font-semibold text-gray-800 mb-3">👥 User Locations</h3>
            <div class="space-y-3">
              <div
                v-for="(user, index) in connectedUsers"
                :key="user.id"
                class="bg-white rounded-lg p-3 border border-gray-200 cursor-pointer hover:shadow-md transition-shadow"
                @click="zoomToLocation(user.location!.lat, user.location!.lng, user.name)"
              >
                <div class="flex items-center space-x-3">
                  <div 
                    class="w-4 h-4 rounded-full"
                    :style="{ backgroundColor: user.color }"
                  ></div>
                  <div class="flex-1 min-w-0">
                    <div class="font-medium text-sm text-gray-800">{{ user.name }}</div>
                    <div class="text-xs text-gray-500 truncate">{{ user.location?.address }}</div>
                    <div class="text-xs text-gray-400">
                      {{ user.location?.lat.toFixed(4) }}, {{ user.location?.lng.toFixed(4) }}
                    </div>
                  </div>
                  <div class="text-lg">{{ getActivityIcon(user.activity) }}</div>
                </div>
                <div class="mt-2 text-xs text-blue-600 font-medium">
                  📍 Click to zoom to location
                </div>
              </div>
            </div>
          </div>

          <!-- Meetup Suggestions -->
          <div>
            <h3 class="text-lg font-semibold text-gray-800 mb-3">🎯 Meetup Suggestions</h3>
            <div class="space-y-3">
              <div
                v-for="suggestion in meetupSuggestions"
                :key="suggestion.id"
                class="bg-white rounded-lg p-3 border border-gray-200 cursor-pointer hover:shadow-md transition-shadow"
                @click="zoomToLocation(suggestion.location.lat, suggestion.location.lng, suggestion.name)"
              >
                <div class="flex items-start space-x-3">
                  <div class="w-4 h-4 bg-red-500 rounded-full mt-1 flex-shrink-0"></div>
                  <div class="flex-1 min-w-0">
                    <div class="font-medium text-sm text-gray-800">{{ suggestion.name }}</div>
                    <div class="text-xs text-gray-500 truncate">{{ suggestion.location.address }}</div>
                    <div class="text-xs text-gray-400">
                      {{ suggestion.location.lat.toFixed(4) }}, {{ suggestion.location.lng.toFixed(4) }}
                    </div>
                    <div class="flex items-center space-x-2 mt-1">
                      <span class="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">
                        ⭐ {{ suggestion.rating.toFixed(1) }}
                      </span>
                      <span class="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                        📍 {{ suggestion.averageDistance.toFixed(1) }}km avg
                      </span>
                    </div>
                    <div class="mt-2 text-xs text-blue-600 font-medium">
                      📍 Click to zoom to location
                    </div>
                  </div>
                  <div class="text-lg">{{ getActivityIcon(suggestion.type) }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Actions -->
      <div class="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
        <div class="text-sm text-gray-600">
          Visualizing {{ connectedUsers.length }} users and {{ meetupSuggestions.length }} suggestions
        </div>
        <button
          class="bg-gradient-to-r from-cosmic-500 to-space-600 text-white py-3 px-6 rounded-xl font-semibold hover:shadow-lg transition-all duration-200"
          @click="$emit('close')"
        >
          Close Map
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { ACTIVITY_TYPES } from '@/types';
import { calculateDistance, calculateMedianPoint } from '@/utils/meetupCalculator';
import type { User, MeetupSuggestion } from '@/types';

interface Props {
  users: User[];
  meetupSuggestions: MeetupSuggestion[];
}

const props = defineProps<Props>();

// Reactive refs
const mapContainer = ref<HTMLElement>();

// Google Maps instances
let map: google.maps.Map | null = null;
let userMarkers: google.maps.Marker[] = [];
let suggestionMarkers: google.maps.Marker[] = [];
let centerMarker: google.maps.Marker | null = null;

// Computed properties
const connectedUsers = computed(() => 
  props.users.filter(user => user.connected && user.location)
);

const centerPoint = computed(() => {
  if (connectedUsers.value.length === 0) return null;
  
  const locations = connectedUsers.value.map(user => ({
    lat: user.location!.lat,
    lng: user.location!.lng
  }));
  
  // Use MEDIAN POINT calculation instead of centroid
  return calculateMedianPoint(locations);
});

const averageDistanceToCenter = computed(() => {
  if (!centerPoint.value || connectedUsers.value.length === 0) return 0;
  
  let totalDistance = 0;
  connectedUsers.value.forEach(user => {
    if (user.location) {
      totalDistance += calculateDistance(
        centerPoint.value!.lat,
        centerPoint.value!.lng,
        user.location.lat,
        user.location.lng
      );
    }
  });
  
  return totalDistance / connectedUsers.value.length;
});

const maxDistanceToCenter = computed(() => {
  if (!centerPoint.value || connectedUsers.value.length === 0) return 0;
  
  let maxDistance = 0;
  connectedUsers.value.forEach(user => {
    if (user.location) {
      const distance = calculateDistance(
        centerPoint.value!.lat,
        centerPoint.value!.lng,
        user.location.lat,
        user.location.lng
      );
      maxDistance = Math.max(maxDistance, distance);
    }
  });
  
  return maxDistance;
});

// Zoom to specific location function
const zoomToLocation = (lat: number, lng: number, name: string) => {
  if (!map) return;
  
  console.log(`🔍 Zooming to ${name} at ${lat}, ${lng}`);
  
  const location = new google.maps.LatLng(lat, lng);
  
  // Animate to the location with a smooth pan and zoom
  map.panTo(location);
  map.setZoom(16); // Close zoom level for detailed view
  
  // Optional: Add a temporary highlight effect
  const highlightMarker = new google.maps.Marker({
    position: location,
    map: map,
    icon: {
      url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
        <svg width="60" height="60" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="30" cy="30" r="25" fill="rgba(59, 130, 246, 0.3)" stroke="#3b82f6" stroke-width="4"/>
          <circle cx="30" cy="30" r="15" fill="rgba(59, 130, 246, 0.5)" stroke="#3b82f6" stroke-width="2"/>
          <circle cx="30" cy="30" r="8" fill="#3b82f6"/>
        </svg>
      `),
      scaledSize: new google.maps.Size(60, 60),
      anchor: new google.maps.Point(30, 30)
    },
    animation: google.maps.Animation.BOUNCE
  });
  
  // Remove the highlight marker after 3 seconds
  setTimeout(() => {
    highlightMarker.setMap(null);
  }, 3000);
  
  // Show info about the location
  const infoWindow = new google.maps.InfoWindow({
    content: `
      <div class="p-2">
        <h3 class="font-semibold text-blue-800">📍 ${name}</h3>
        <p class="text-sm text-gray-600">Zoomed to this location</p>
        <p class="text-xs text-gray-400">${lat.toFixed(6)}, ${lng.toFixed(6)}</p>
      </div>
    `,
    position: location
  });
  
  infoWindow.open(map);
  
  // Close info window after 4 seconds
  setTimeout(() => {
    infoWindow.close();
  }, 4000);
};

// Initialize Google Maps
const initializeMap = () => {
  if (!mapContainer.value || !window.google) return;

  // Calculate bounds to fit all locations
  const bounds = new google.maps.LatLngBounds();
  
  // Add user locations to bounds
  connectedUsers.value.forEach(user => {
    if (user.location) {
      bounds.extend(new google.maps.LatLng(user.location.lat, user.location.lng));
    }
  });
  
  // Add suggestion locations to bounds
  props.meetupSuggestions.forEach(suggestion => {
    bounds.extend(new google.maps.LatLng(suggestion.location.lat, suggestion.location.lng));
  });
  
  // Add center point to bounds
  if (centerPoint.value) {
    bounds.extend(new google.maps.LatLng(centerPoint.value.lat, centerPoint.value.lng));
  }

  // Create map
  map = new google.maps.Map(mapContainer.value, {
    mapTypeControl: true,
    streetViewControl: false,
    fullscreenControl: true,
    styles: [
      {
        featureType: 'poi',
        elementType: 'labels',
        stylers: [{ visibility: 'on' }]
      }
    ]
  });

  // Fit map to bounds
  if (!bounds.isEmpty()) {
    map.fitBounds(bounds);
    
    // Add some padding
    setTimeout(() => {
      if (map) {
        const currentZoom = map.getZoom();
        if (currentZoom && currentZoom > 15) {
          map.setZoom(15); // Don't zoom in too much
        }
      }
    }, 100);
  }

  // Add markers
  addUserMarkers();
  addSuggestionMarkers();
  addCenterMarker();
};

// Add user location markers
const addUserMarkers = () => {
  if (!map) return;

  // Clear existing markers
  userMarkers.forEach(marker => marker.setMap(null));
  userMarkers = [];

  connectedUsers.value.forEach((user, index) => {
    if (!user.location) return;

    const marker = new google.maps.Marker({
      position: { lat: user.location.lat, lng: user.location.lng },
      map: map,
      title: `${user.name} - ${user.location.address}`,
      icon: {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="16" cy="16" r="12" fill="${user.color}" stroke="white" stroke-width="3"/>
            <text x="16" y="20" text-anchor="middle" fill="white" font-size="12" font-weight="bold">${index + 1}</text>
          </svg>
        `),
        scaledSize: new google.maps.Size(32, 32),
        anchor: new google.maps.Point(16, 16)
      }
    });

    // Add info window
    const infoWindow = new google.maps.InfoWindow({
      content: `
        <div class="p-2">
          <h3 class="font-semibold text-gray-800">${user.name}</h3>
          <p class="text-sm text-gray-600">${user.location.address}</p>
          <p class="text-xs text-gray-500">Activity: ${getActivityName(user.activity)} ${getActivityIcon(user.activity)}</p>
          <p class="text-xs text-gray-400">${user.location.lat.toFixed(6)}, ${user.location.lng.toFixed(6)}</p>
        </div>
      `
    });

    marker.addListener('click', () => {
      // Close other info windows
      userMarkers.forEach(m => {
        const iw = (m as any).infoWindow;
        if (iw) iw.close();
      });
      suggestionMarkers.forEach(m => {
        const iw = (m as any).infoWindow;
        if (iw) iw.close();
      });
      
      infoWindow.open(map, marker);
      
      // Also zoom to this location
      zoomToLocation(user.location!.lat, user.location!.lng, user.name);
    });

    (marker as any).infoWindow = infoWindow;
    userMarkers.push(marker);
  });
};

// Add suggestion markers
const addSuggestionMarkers = () => {
  if (!map) return;

  // Clear existing markers
  suggestionMarkers.forEach(marker => marker.setMap(null));
  suggestionMarkers = [];

  props.meetupSuggestions.forEach((suggestion, index) => {
    const marker = new google.maps.Marker({
      position: { lat: suggestion.location.lat, lng: suggestion.location.lng },
      map: map,
      title: `${suggestion.name} - ${suggestion.location.address}`,
      icon: {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="16" cy="16" r="12" fill="#ef4444" stroke="white" stroke-width="3"/>
            <text x="16" y="20" text-anchor="middle" fill="white" font-size="10" font-weight="bold">${index + 1}</text>
          </svg>
        `),
        scaledSize: new google.maps.Size(32, 32),
        anchor: new google.maps.Point(16, 16)
      }
    });

    // Add info window
    const infoWindow = new google.maps.InfoWindow({
      content: `
        <div class="p-2">
          <h3 class="font-semibold text-gray-800">${suggestion.name}</h3>
          <p class="text-sm text-gray-600">${suggestion.location.address}</p>
          <div class="flex items-center space-x-2 mt-1">
            <span class="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">⭐ ${suggestion.rating.toFixed(1)}</span>
            <span class="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">📍 ${suggestion.averageDistance.toFixed(1)}km avg</span>
          </div>
          <p class="text-xs text-gray-500 mt-1">Type: ${getActivityName(suggestion.type)} ${getActivityIcon(suggestion.type)}</p>
          <p class="text-xs text-gray-400">${suggestion.location.lat.toFixed(6)}, ${suggestion.location.lng.toFixed(6)}</p>
        </div>
      `
    });

    marker.addListener('click', () => {
      // Close other info windows
      userMarkers.forEach(m => {
        const iw = (m as any).infoWindow;
        if (iw) iw.close();
      });
      suggestionMarkers.forEach(m => {
        const iw = (m as any).infoWindow;
        if (iw) iw.close();
      });
      
      infoWindow.open(map, marker);
      
      // Also zoom to this location
      zoomToLocation(suggestion.location.lat, suggestion.location.lng, suggestion.name);
    });

    (marker as any).infoWindow = infoWindow;
    suggestionMarkers.push(marker);
  });
};

// Add center point marker
const addCenterMarker = () => {
  if (!map || !centerPoint.value) return;

  // Clear existing center marker
  if (centerMarker) {
    centerMarker.setMap(null);
  }

  centerMarker = new google.maps.Marker({
    position: { lat: centerPoint.value.lat, lng: centerPoint.value.lng },
    map: map,
    title: 'Median Center Point',
    icon: {
      url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="20" cy="20" r="15" fill="#22c55e" stroke="white" stroke-width="4"/>
          <circle cx="20" cy="20" r="6" fill="white"/>
          <text x="20" y="50" text-anchor="middle" fill="#22c55e" font-size="10" font-weight="bold">MEDIAN</text>
        </svg>
      `),
      scaledSize: new google.maps.Size(40, 40),
      anchor: new google.maps.Point(20, 20)
    }
  });

  // Add info window for center point
  const infoWindow = new google.maps.InfoWindow({
    content: `
      <div class="p-2">
        <h3 class="font-semibold text-green-800">Median Center Point</h3>
        <p class="text-sm text-gray-600">Calculated optimal meeting point using median algorithm</p>
        <p class="text-xs text-gray-500">Avg distance: ${averageDistanceToCenter.value.toFixed(2)} km</p>
        <p class="text-xs text-gray-500">Max distance: ${maxDistanceToCenter.value.toFixed(2)} km</p>
        <p class="text-xs text-gray-400">${centerPoint.value.lat.toFixed(6)}, ${centerPoint.value.lng.toFixed(6)}</p>
      </div>
    `
  });

  centerMarker.addListener('click', () => {
    // Close other info windows
    userMarkers.forEach(m => {
      const iw = (m as any).infoWindow;
      if (iw) iw.close();
    });
    suggestionMarkers.forEach(m => {
      const iw = (m as any).infoWindow;
      if (iw) iw.close();
    });
    
    infoWindow.open(map, centerMarker);
    
    // Also zoom to center point
    zoomToLocation(centerPoint.value!.lat, centerPoint.value!.lng, 'Median Center Point');
  });
};

// Helper functions
const getActivityIcon = (activityId: string | null | undefined) => {
  if (!activityId) return '🎯';
  const activity = ACTIVITY_TYPES.find(a => a.id === activityId);
  return activity?.icon || '🎯';
};

const getActivityName = (activityId: string | null | undefined) => {
  if (!activityId) return 'Unknown';
  const activity = ACTIVITY_TYPES.find(a => a.id === activityId);
  return activity?.name || 'Unknown';
};

// Wait for Google Maps to load
const waitForGoogleMaps = () => {
  if (window.google && window.google.maps) {
    initializeMap();
  } else {
    setTimeout(waitForGoogleMaps, 100);
  }
};

// Lifecycle
onMounted(() => {
  waitForGoogleMaps();
});

onUnmounted(() => {
  // Clean up markers
  userMarkers.forEach(marker => marker.setMap(null));
  suggestionMarkers.forEach(marker => marker.setMap(null));
  if (centerMarker) {
    centerMarker.setMap(null);
  }
});

// Emits
defineEmits<{
  close: []
}>();
</script>

<style scoped>
/* Ensure map container has proper dimensions */
.map-container {
  min-height: 400px;
}
</style>