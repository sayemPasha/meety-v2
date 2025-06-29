<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
    <div class="bg-white rounded-2xl max-w-4xl w-full my-8 shadow-2xl">
      <div class="p-6 border-b border-gray-200">
        <h2 class="text-2xl font-bold text-gray-800 mb-2">👤 Set Up Your Profile</h2>
        <p class="text-gray-600">Enter your name, select your location, and choose your preferred activity</p>
      </div>
      
      <div class="flex flex-col lg:flex-row h-[70vh] min-h-[500px]">
        <!-- Map Container -->
        <div class="flex-1 relative">
          <div 
            ref="mapContainer" 
            class="w-full h-full min-h-[300px]"
          ></div>
          
          <!-- Search Box Overlay -->
          <div class="absolute top-4 left-4 right-4 z-10">
            <div class="relative">
              <input
                ref="searchInput"
                type="text"
                placeholder="Search for a location..."
                class="w-full px-4 py-3 pr-12 bg-white border border-gray-300 rounded-xl shadow-lg focus:ring-2 focus:ring-cosmic-500 focus:border-transparent transition-all duration-200"
              />
              <button
                class="absolute right-3 top-1/2 transform -translate-y-1/2 text-cosmic-500 hover:text-cosmic-600 transition-colors"
                @click="getCurrentLocation"
                title="Use current location"
              >
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                </svg>
              </button>
            </div>
          </div>

          <!-- Selected Location Info -->
          <div 
            v-if="selectedLocation" 
            class="absolute bottom-4 left-4 right-4 z-10"
          >
            <div class="bg-white rounded-xl p-4 shadow-lg border border-gray-200">
              <div class="flex items-start space-x-3">
                <div class="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <span class="text-white text-sm">✓</span>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="font-medium text-gray-800 truncate">{{ selectedLocation.address }}</div>
                  <div class="text-sm text-gray-500">
                    {{ selectedLocation.lat.toFixed(6) }}, {{ selectedLocation.lng.toFixed(6) }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Profile Setup Panel -->
        <div class="lg:w-80 p-6 border-t lg:border-t-0 lg:border-l border-gray-200 bg-gray-50">
          <!-- User Name Section -->
          <div class="mb-6">
            <h3 class="text-lg font-semibold text-gray-800 mb-3">Your Name</h3>
            <div class="relative">
              <input
                v-model="userName"
                type="text"
                placeholder="Enter your name..."
                maxlength="30"
                class="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-cosmic-500 focus:border-transparent transition-all duration-200"
              />
              <div class="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm">
                {{ userName.length }}/30
              </div>
            </div>
            <p class="text-xs text-gray-500 mt-2">This name will be visible to other participants</p>
          </div>

          <!-- Activity Selection -->
          <div class="mb-6">
            <h3 class="text-lg font-semibold text-gray-800 mb-3">Preferred Activity</h3>
            <div class="grid grid-cols-2 gap-3">
              <div
                v-for="activity in ACTIVITY_TYPES"
                :key="activity.id"
                class="relative cursor-pointer transition-all duration-200 hover:scale-105"
                @click="selectedActivity = activity.id"
              >
                <div
                  class="border-2 rounded-xl p-3 text-center"
                  :class="selectedActivity === activity.id 
                    ? 'border-cosmic-500 bg-cosmic-50' 
                    : 'border-gray-200 hover:border-gray-300 bg-white'"
                >
                  <div class="text-xl mb-1">{{ activity.icon }}</div>
                  <div class="text-xs font-medium text-gray-700">{{ activity.name }}</div>
                </div>
                
                <!-- Selected indicator -->
                <div
                  v-if="selectedActivity === activity.id"
                  class="absolute -top-2 -right-2 w-5 h-5 bg-cosmic-500 rounded-full flex items-center justify-center"
                >
                  <span class="text-white text-xs">✓</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Instructions -->
          <div class="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <h4 class="font-medium text-blue-800 mb-2">Setup Steps:</h4>
            <ul class="text-sm text-blue-700 space-y-1">
              <li class="flex items-center space-x-2">
                <span :class="userName.trim() ? 'text-green-600' : 'text-blue-600'">
                  {{ userName.trim() ? '✓' : '1.' }}
                </span>
                <span>Enter your name</span>
              </li>
              <li class="flex items-center space-x-2">
                <span :class="selectedLocation ? 'text-green-600' : 'text-blue-600'">
                  {{ selectedLocation ? '✓' : '2.' }}
                </span>
                <span>Select your location</span>
              </li>
              <li class="flex items-center space-x-2">
                <span :class="selectedActivity ? 'text-green-600' : 'text-blue-600'">
                  {{ selectedActivity ? '✓' : '3.' }}
                </span>
                <span>Choose preferred activity</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
      
      <!-- Actions -->
      <div class="px-6 py-4 bg-gray-50 border-t border-gray-200 flex space-x-3">
        <button
          class="flex-1 bg-gray-200 text-gray-700 py-3 px-6 rounded-xl font-semibold hover:bg-gray-300 transition-all duration-200"
          @click="$emit('close')"
        >
          Cancel
        </button>
        <button
          class="flex-1 bg-gradient-to-r from-cosmic-500 to-space-600 text-white py-3 px-6 rounded-xl font-semibold hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="!isFormValid"
          @click="confirmSelection"
        >
          {{ isFormValid ? 'Join Meetup' : 'Complete Setup' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useMeetyStore } from '@/stores/meetyStore';
import { ACTIVITY_TYPES } from '@/types';

const store = useMeetyStore();

// Reactive refs
const mapContainer = ref<HTMLElement>();
const searchInput = ref<HTMLInputElement>();
const selectedLocation = ref<{ lat: number; lng: number; address: string } | null>(null);
const selectedActivity = ref<string>('');
const userName = ref<string>('');

// Computed properties
const isFormValid = computed(() => 
  userName.value.trim().length >= 2 && 
  selectedLocation.value && 
  selectedActivity.value
);

// Google Maps instances
let map: google.maps.Map | null = null;
let marker: google.maps.Marker | null = null;
let searchBox: google.maps.places.SearchBox | null = null;
let geocoder: google.maps.Geocoder | null = null;

// Initialize with current user data if available
onMounted(() => {
  const currentUser = store.currentUser;
  if (currentUser) {
    userName.value = currentUser.name || '';
    selectedActivity.value = currentUser.activity || '';
    if (currentUser.location) {
      selectedLocation.value = currentUser.location;
    }
  }
  
  waitForGoogleMaps();
});

// Initialize Google Maps
const initializeMap = () => {
  if (!mapContainer.value || !window.google) return;

  // Default to New York City
  const defaultCenter = { lat: 40.7128, lng: -74.0060 };

  // Create map
  map = new google.maps.Map(mapContainer.value, {
    zoom: 12,
    center: defaultCenter,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    styles: [
      {
        featureType: 'poi',
        elementType: 'labels',
        stylers: [{ visibility: 'on' }]
      }
    ]
  });

  // Initialize geocoder
  geocoder = new google.maps.Geocoder();

  // Initialize search box
  if (searchInput.value) {
    searchBox = new google.maps.places.SearchBox(searchInput.value);
    
    // Bias the SearchBox results towards current map's viewport
    map.addListener('bounds_changed', () => {
      if (searchBox && map) {
        searchBox.setBounds(map.getBounds()!);
      }
    });

    // Listen for the event fired when the user selects a prediction
    searchBox.addListener('places_changed', () => {
      if (!searchBox) return;
      
      const places = searchBox.getPlaces();
      if (places && places.length > 0) {
        const place = places[0];
        if (place.geometry && place.geometry.location) {
          const location = {
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
            address: place.formatted_address || place.name || 'Selected Location'
          };
          
          setSelectedLocation(location);
          
          // Center map on selected place
          if (map) {
            map.setCenter(place.geometry.location);
            map.setZoom(15);
          }
        }
      }
    });
  }

  // Add click listener to map
  map.addListener('click', (event: google.maps.MapMouseEvent) => {
    if (event.latLng) {
      const lat = event.latLng.lat();
      const lng = event.latLng.lng();
      
      // Reverse geocode to get address
      if (geocoder) {
        geocoder.geocode(
          { location: { lat, lng } },
          (results, status) => {
            let address = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
            
            if (status === 'OK' && results && results[0]) {
              address = results[0].formatted_address;
            }
            
            setSelectedLocation({ lat, lng, address });
          }
        );
      } else {
        setSelectedLocation({ 
          lat, 
          lng, 
          address: `${lat.toFixed(6)}, ${lng.toFixed(6)}` 
        });
      }
    }
  });

  // Try to get user's current location
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        
        if (map) {
          map.setCenter(userLocation);
          map.setZoom(14);
        }
      },
      (error) => {
        console.log('Geolocation error:', error);
        // Keep default location
      }
    );
  }
};

// Set selected location and update marker
const setSelectedLocation = (location: { lat: number; lng: number; address: string }) => {
  selectedLocation.value = location;
  
  if (map) {
    // Remove existing marker
    if (marker) {
      marker.setMap(null);
    }
    
    // Add new marker
    marker = new google.maps.Marker({
      position: { lat: location.lat, lng: location.lng },
      map: map,
      title: location.address,
      icon: {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="16" cy="16" r="12" fill="#3b82f6" stroke="white" stroke-width="3"/>
            <circle cx="16" cy="16" r="4" fill="white"/>
          </svg>
        `),
        scaledSize: new google.maps.Size(32, 32),
        anchor: new google.maps.Point(16, 16)
      }
    });
  }
};

// Get current location
const getCurrentLocation = () => {
  if (!navigator.geolocation) {
    alert('Geolocation is not supported by this browser.');
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      
      // Reverse geocode to get address
      if (geocoder) {
        geocoder.geocode(
          { location: { lat: latitude, lng: longitude } },
          (results, status) => {
            let address = `${latitude.toFixed(6)}, ${longitude.toFixed(6)} (Current Location)`;
            
            if (status === 'OK' && results && results[0]) {
              address = results[0].formatted_address + ' (Current Location)';
            }
            
            const location = { lat: latitude, lng: longitude, address };
            setSelectedLocation(location);
            
            // Center map on current location
            if (map) {
              map.setCenter({ lat: latitude, lng: longitude });
              map.setZoom(15);
            }
          }
        );
      } else {
        const location = {
          lat: latitude,
          lng: longitude,
          address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)} (Current Location)`
        };
        setSelectedLocation(location);
        
        if (map) {
          map.setCenter({ lat: latitude, lng: longitude });
          map.setZoom(15);
        }
      }
    },
    (error) => {
      console.error('Geolocation error:', error);
      alert('Unable to retrieve your location. Please try again or select manually on the map.');
    }
  );
};

// Confirm selection
const confirmSelection = () => {
  if (isFormValid.value) {
    // Update user name first
    store.updateUserName(userName.value.trim());
    
    // Then update location and activity
    store.updateUserLocation(selectedLocation.value!);
    store.updateUserActivity(selectedActivity.value);
    
    emit('close');
  }
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
onUnmounted(() => {
  // Clean up marker
  if (marker) {
    marker.setMap(null);
  }
});

// Emits
const emit = defineEmits<{
  close: []
}>();
</script>

<style scoped>
/* Ensure map container has proper dimensions */
.map-container {
  min-height: 400px;
}

/* Custom scrollbar for activity selection */
.activity-grid::-webkit-scrollbar {
  width: 4px;
}

.activity-grid::-webkit-scrollbar-track {
  background: #f1f5f9;
}

.activity-grid::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 2px;
}
</style>