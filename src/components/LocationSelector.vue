<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div class="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
      <div class="p-6 border-b border-gray-200">
        <h2 class="text-2xl font-bold text-gray-800 mb-2">📍 Select Your Location</h2>
        <p class="text-gray-600">Choose your location and preferred activity</p>
      </div>
      
      <div class="p-6 space-y-6">
        <!-- Location Input -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Location
          </label>
          <div class="relative">
            <input
              v-model="locationQuery"
              type="text"
              placeholder="Enter address or city..."
              class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cosmic-500 focus:border-transparent transition-all duration-200"
              @keyup.enter="searchLocation"
            />
            <button
              class="absolute right-3 top-1/2 transform -translate-y-1/2 text-cosmic-500 hover:text-cosmic-600"
              @click="getCurrentLocation"
              title="Use current location"
            >
              🎯
            </button>
          </div>
          
          <!-- Location suggestions -->
          <div v-if="locationSuggestions.length" class="mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-32 overflow-y-auto">
            <div
              v-for="suggestion in locationSuggestions"
              :key="suggestion.id"
              class="px-4 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
              @click="selectLocation(suggestion)"
            >
              <div class="font-medium text-sm">{{ suggestion.name }}</div>
              <div class="text-xs text-gray-500">{{ suggestion.address }}</div>
            </div>
          </div>
        </div>

        <!-- Selected Location Display -->
        <div v-if="selectedLocation" class="bg-gradient-to-r from-emerald-50 to-emerald-100 border border-emerald-200 rounded-xl p-4">
          <div class="flex items-center space-x-2">
            <span class="text-emerald-600">✅</span>
            <div>
              <div class="font-medium text-emerald-800">{{ selectedLocation.address }}</div>
              <div class="text-sm text-emerald-600">{{ selectedLocation.lat.toFixed(4) }}, {{ selectedLocation.lng.toFixed(4) }}</div>
            </div>
          </div>
        </div>

        <!-- Activity Selection -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-3">
            Preferred Activity
          </label>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div
              v-for="activity in ACTIVITY_TYPES"
              :key="activity.id"
              class="relative cursor-pointer transition-all duration-200 hover:scale-105"
              @click="selectedActivity = activity.id"
            >
              <div
                class="border-2 rounded-xl p-4 text-center"
                :class="selectedActivity === activity.id 
                  ? 'border-cosmic-500 bg-cosmic-50' 
                  : 'border-gray-200 hover:border-gray-300'"
              >
                <div class="text-2xl mb-2">{{ activity.icon }}</div>
                <div class="text-sm font-medium text-gray-700">{{ activity.name }}</div>
              </div>
              
              <!-- Selected indicator -->
              <div
                v-if="selectedActivity === activity.id"
                class="absolute -top-2 -right-2 w-6 h-6 bg-cosmic-500 rounded-full flex items-center justify-center"
              >
                <span class="text-white text-sm">✓</span>
              </div>
            </div>
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
          :disabled="!selectedLocation || !selectedActivity"
          @click="confirmSelection"
        >
          Confirm Selection
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useMeetyStore } from '@/stores/meetyStore';
import { ACTIVITY_TYPES } from '@/types';

const store = useMeetyStore();

// Reactive refs
const locationQuery = ref('');
const selectedLocation = ref<{ lat: number; lng: number; address: string } | null>(null);
const selectedActivity = ref<string>('');
const locationSuggestions = ref<Array<{ id: string; name: string; address: string; lat: number; lng: number }>>([]);
const isLoading = ref(false);

// Methods
const searchLocation = async () => {
  if (!locationQuery.value.trim()) return;
  
  isLoading.value = true;
  try {
    // Simulate geocoding API call
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Mock location suggestions
    locationSuggestions.value = [
      {
        id: '1',
        name: locationQuery.value,
        address: `${locationQuery.value}, NY, USA`,
        lat: 40.7128 + (Math.random() - 0.5) * 0.1,
        lng: -74.0060 + (Math.random() - 0.5) * 0.1
      },
      {
        id: '2',
        name: `${locationQuery.value} Center`,
        address: `${locationQuery.value} Center, NY, USA`,
        lat: 40.7128 + (Math.random() - 0.5) * 0.1,
        lng: -74.0060 + (Math.random() - 0.5) * 0.1
      }
    ];
  } catch (error) {
    console.error('Location search failed:', error);
  } finally {
    isLoading.value = false;
  }
};

const getCurrentLocation = () => {
  if (!navigator.geolocation) {
    alert('Geolocation is not supported by this browser.');
    return;
  }

  isLoading.value = true;
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const { latitude, longitude } = position.coords;
      
      // Simulate reverse geocoding
      await new Promise(resolve => setTimeout(resolve, 500));
      
      selectedLocation.value = {
        lat: latitude,
        lng: longitude,
        address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)} (Current Location)`
      };
      
      locationQuery.value = selectedLocation.value.address;
      locationSuggestions.value = [];
      isLoading.value = false;
    },
    (error) => {
      console.error('Geolocation error:', error);
      alert('Unable to retrieve your location.');
      isLoading.value = false;
    }
  );
};

const selectLocation = (suggestion: any) => {
  selectedLocation.value = {
    lat: suggestion.lat,
    lng: suggestion.lng,
    address: suggestion.address
  };
  locationQuery.value = suggestion.address;
  locationSuggestions.value = [];
};

const confirmSelection = () => {
  if (selectedLocation.value && selectedActivity.value) {
    store.updateUserLocation(selectedLocation.value);
    store.updateUserActivity(selectedActivity.value);
    emit('close');
  }
};

// Auto-search on input
let searchTimeout: number;
const watchLocationQuery = () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    if (locationQuery.value.length >= 3) {
      searchLocation();
    } else {
      locationSuggestions.value = [];
    }
  }, 300);
};

// Watch location query changes
onMounted(() => {
  // Set up reactive watching
  const unwatchQuery = () => {
    // This would be implemented with proper Vue 3 watchers in a real app
  };
});

// Emits
const emit = defineEmits<{
  close: []
}>();
</script>