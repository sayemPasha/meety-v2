<template>
  <div class="relative w-full h-full overflow-hidden">
    <!-- Center Node -->
    <div
      ref="centerNode"
      class="absolute transform -translate-x-1/2 -translate-y-1/2 z-20"
      :style="{ left: centerPosition.x + 'px', top: centerPosition.y + 'px' }"
    >
      <div
        class="w-24 h-24 rounded-full bg-gradient-to-br from-cosmic-500 to-space-600 border-4 border-white shadow-2xl cursor-pointer transition-all duration-300 hover:scale-110 flex items-center justify-center"
        :class="{ 'animate-pulse-glow': canGenerateMeetups }"
        @click="handleCenterNodeClick"
      >
        <div class="text-white text-center">
          <div class="text-2xl mb-1">🌟</div>
          <div class="text-xs font-semibold">Meety</div>
        </div>
      </div>
    </div>

    <!-- User Nodes -->
    <div
      v-for="(user, index) in users"
      :key="`user-${user.id}`"
      ref="userNodes"
      class="absolute transform -translate-x-1/2 -translate-y-1/2 z-20 animate-node-appear"
      :style="{ 
        left: getUserPosition(index).x + 'px', 
        top: getUserPosition(index).y + 'px',
        animationDelay: `${index * 0.2}s`
      }"
    >
      <div
        class="relative w-20 h-20 rounded-full border-4 border-white shadow-xl cursor-pointer transition-all duration-300 hover:scale-105 animate-float flex items-center justify-center"
        :class="user.connected ? 'bg-gradient-to-br from-emerald-400 to-emerald-600' : 'bg-gradient-to-br from-gray-400 to-gray-600'"
        :style="{ 
          backgroundColor: user.connected ? user.color : '#6b7280',
          animationDelay: `${index * 0.5}s`
        }"
        @click="handleUserNodeClick(user)"
      >
        <!-- Location pin icon -->
        <div v-if="user.location" class="absolute -top-2 -right-2 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-lg">
          <span class="text-sm">📍</span>
        </div>
        
        <!-- Plus icon for unconnected users -->
        <div v-if="!user.connected && user.id === currentUserId" class="text-white text-2xl font-bold">+</div>
        
        <!-- User info -->
        <div v-else class="text-white text-center">
          <div class="text-lg">👤</div>
          <div class="text-xs font-semibold">{{ user.name }}</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Meetup Suggestions Modal - REDUCED WIDTH -->
  <Teleport to="body">
    <div
      v-if="showMeetupModal"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4"
      @click="closeMeetupModal"
    >
      <div 
        class="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden shadow-2xl"
        @click.stop
      >
        <div class="p-6 border-b border-gray-200">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-2xl font-bold text-gray-800 mb-2">🎯 Suggested Meetup Locations</h2>
              <p class="text-gray-600">
                {{ connectedUsers.length === 1 ? 'Places near your location' : 'Based on everyone\'s preferences and locations' }}
              </p>
            </div>
            <!-- Close button -->
            <button
              class="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
              @click="closeMeetupModal"
            >
              <span class="text-gray-600">✕</span>
            </button>
          </div>
        </div>
        
        <div class="p-6 space-y-6 max-h-96 overflow-y-auto">
          <div
            v-for="(suggestion, index) in meetupSuggestions"
            :key="suggestion.id"
            class="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-all duration-200"
          >
            <!-- Alternating Layout -->
            <div 
              class="flex"
              :class="index % 2 === 0 ? 'flex-row' : 'flex-row-reverse'"
            >
              <!-- Image Section -->
              <div class="w-40 h-28 flex-shrink-0">
                <div 
                  v-if="suggestion.photoUrl"
                  class="w-full h-full overflow-hidden"
                >
                  <img 
                    :src="suggestion.photoUrl" 
                    :alt="suggestion.name"
                    class="w-full h-full object-cover"
                    @error="handleImageError"
                  />
                </div>
                <div 
                  v-else
                  class="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center"
                >
                  <span class="text-3xl">{{ getActivityIcon(suggestion.type) }}</span>
                </div>
              </div>

              <!-- Content Section -->
              <div class="flex-1 p-4">
                <!-- Title and Rating -->
                <div class="flex items-start justify-between mb-2">
                  <h3 class="font-bold text-lg text-gray-900 leading-tight">{{ suggestion.name }}</h3>
                  <div class="flex items-center space-x-1 ml-3">
                    <span class="text-yellow-500 text-sm">⭐</span>
                    <span class="font-semibold text-sm text-gray-800">{{ suggestion.rating.toFixed(1) }}</span>
                  </div>
                </div>
                
                <!-- Address -->
                <p class="text-gray-600 text-sm mb-3 leading-relaxed">{{ suggestion.location.address }}</p>
                
                <!-- Status and Info -->
                <div class="flex items-center justify-between">
                  <div class="flex items-center space-x-3">
                    <!-- Open Status -->
                    <div v-if="suggestion.openNow !== undefined" class="flex items-center space-x-1">
                      <div 
                        class="w-2 h-2 rounded-full"
                        :class="suggestion.openNow ? 'bg-green-500' : 'bg-red-500'"
                      ></div>
                      <span class="text-xs font-medium" :class="suggestion.openNow ? 'text-green-700' : 'text-red-700'">
                        {{ suggestion.openNow ? 'Open' : 'Closed' }}
                      </span>
                    </div>
                    
                    <!-- Distance -->
                    <span class="text-xs text-gray-500">
                      {{ connectedUsers.length === 1 
                        ? `${suggestion.distance.toFixed(1)}km away` 
                        : `${suggestion.averageDistance.toFixed(1)}km avg` 
                      }}
                    </span>
                    
                    <!-- Price Level -->
                    <div v-if="suggestion.priceLevel" class="flex items-center">
                      <span class="text-green-600 text-xs font-medium">
                        {{ '$'.repeat(suggestion.priceLevel) }}
                      </span>
                    </div>
                  </div>
                  
                  <!-- Action Button -->
                  <button
                    class="px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-xs font-medium"
                    @click="openInMaps(suggestion)"
                  >
                    View on Map
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- No suggestions message -->
          <div v-if="meetupSuggestions.length === 0" class="text-center py-8">
            <div class="text-6xl mb-4">🤔</div>
            <h3 class="text-lg font-semibold text-gray-800 mb-2">No suggestions yet</h3>
            <p class="text-gray-600">
              {{ connectedUsers.length === 0 
                ? 'Set your location and activity to get started.' 
                : 'Make sure all users have set their locations and activities.' 
              }}
            </p>
            <button
              v-if="canGenerateMeetups"
              class="mt-4 bg-gradient-to-r from-cosmic-500 to-space-600 text-white py-3 px-6 rounded-xl font-semibold hover:shadow-lg transition-all duration-200"
              @click="generateSuggestions"
              :disabled="store.isLoading"
            >
              {{ store.isLoading ? '🔄 Generating...' : '🎯 Generate Suggestions' }}
            </button>
          </div>
        </div>
        
        <div class="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
          <div class="text-sm text-gray-600">
            {{ connectedUsers.length === 1 
              ? `Showing ${meetupSuggestions.length} suggestion${meetupSuggestions.length !== 1 ? 's' : ''} near you`
              : `Showing ${meetupSuggestions.length} suggestion${meetupSuggestions.length !== 1 ? 's' : ''} for ${connectedUsers.length} users`
            }}
          </div>
          <div class="flex items-center space-x-3">
            <!-- Check Locations Button -->
            <button
              v-if="meetupSuggestions.length > 0"
              class="bg-gradient-to-r from-green-500 to-emerald-600 text-white py-2 px-4 rounded-lg font-medium hover:shadow-lg transition-all duration-200"
              @click="showLocationMap = true"
            >
              🗺️ Check Locations
            </button>
            <button
              v-if="canGenerateMeetups"
              class="bg-gradient-to-r from-emerald-500 to-teal-600 text-white py-2 px-4 rounded-lg font-medium hover:shadow-lg transition-all duration-200"
              @click="refreshSuggestions"
              :disabled="store.isLoading"
            >
              {{ store.isLoading ? '🔄 Refreshing...' : '🔄 Refresh' }}
            </button>
            <button
              class="bg-gradient-to-r from-cosmic-500 to-space-600 text-white py-3 px-6 rounded-xl font-semibold hover:shadow-lg transition-all duration-200"
              @click="closeMeetupModal"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- Location Visualization Map Modal -->
  <Teleport to="body">
    <LocationVisualizationMap
      v-if="showLocationMap"
      :users="users"
      :meetup-suggestions="meetupSuggestions"
      @close="showLocationMap = false"
    />
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useMeetyStore } from '@/stores/meetyStore';
import { ACTIVITY_TYPES } from '@/types';
import LocationVisualizationMap from './LocationVisualizationMap.vue';

const store = useMeetyStore();

// Reactive refs
const containerWidth = ref(800);
const containerHeight = ref(600);
const centerNode = ref<HTMLElement>();
const userNodes = ref<HTMLElement[]>([]);
const showMeetupModal = ref(false);
const showLocationMap = ref(false);

// Computed properties
const users = computed(() => store.currentSession?.users || []);
const currentUserId = computed(() => store.currentUserId);
const canGenerateMeetups = computed(() => store.canGenerateMeetups);
const connectedUsers = computed(() => store.connectedUsers);
const meetupSuggestions = computed(() => store.currentSession?.meetupSuggestions || []);

const centerPosition = computed(() => ({
  x: containerWidth.value / 2,
  y: containerHeight.value / 2
}));

// Methods
const getUserPosition = (index: number) => {
  const radius = 200;
  const angleStep = (2 * Math.PI) / Math.max(users.value.length, 3);
  const angle = index * angleStep - Math.PI / 2; // Start from top
  
  return {
    x: centerPosition.value.x + radius * Math.cos(angle),
    y: centerPosition.value.y + radius * Math.sin(angle)
  };
};

const handleCenterNodeClick = async () => {
  if (canGenerateMeetups.value) {
    console.log('🎯 Center node clicked - generating meetup suggestions...');
    console.log('Connected users:', store.connectedUsers.map(u => ({
      name: u.name,
      location: u.location,
      activity: u.activity
    })));
    
    await generateSuggestions();
    showMeetupModal.value = true;
  } else {
    console.log('❌ Cannot generate meetups yet');
    console.log('Connected users count:', store.connectedUsers.length);
    console.log('Users with location and activity:', store.connectedUsers.filter(u => u.location && u.activity).length);
    console.log('Requirements: Need at least 1 connected user with location and activity set');
  }
};

const handleUserNodeClick = (user: any) => {
  if (user.id === currentUserId.value && !user.connected) {
    // Emit event to parent to show location/activity selection
    emit('showUserSetup');
  }
};

const generateSuggestions = async () => {
  console.log('🎯 Generating fresh suggestions...');
  await store.generateMeetupSuggestions();
};

const refreshSuggestions = async () => {
  console.log('🔄 Manually refreshing suggestions...');
  await store.generateMeetupSuggestions();
};

const closeMeetupModal = () => {
  showMeetupModal.value = false;
};

const getActivityIcon = (type: string) => {
  const activity = ACTIVITY_TYPES.find(a => a.id === type);
  return activity?.icon || '📍';
};

const getActivityName = (type: string) => {
  const activity = ACTIVITY_TYPES.find(a => a.id === type);
  return activity?.name || 'Unknown';
};

const openInMaps = (suggestion: any) => {
  const { lat, lng } = suggestion.location;
  const query = encodeURIComponent(suggestion.name);
  
  // Try to open in Google Maps with place ID if available
  let mapsUrl = '';
  if (suggestion.placeId) {
    mapsUrl = `https://www.google.com/maps/place/?q=place_id:${suggestion.placeId}`;
  } else {
    // Fallback to coordinates and name
    mapsUrl = `https://www.google.com/maps/search/${query}/@${lat},${lng},15z`;
  }
  
  window.open(mapsUrl, '_blank');
};

const handleImageError = (event: Event) => {
  const img = event.target as HTMLImageElement;
  img.style.display = 'none';
  // The fallback div will show instead
};

const updateContainerSize = () => {
  const container = document.querySelector('.node-container');
  if (container) {
    containerWidth.value = container.clientWidth;
    containerHeight.value = container.clientHeight;
  }
};

// Lifecycle
onMounted(() => {
  updateContainerSize();
  window.addEventListener('resize', updateContainerSize);
});

onUnmounted(() => {
  window.removeEventListener('resize', updateContainerSize);
});

// Watch for changes in users to trigger re-render
watch(users, () => {
  // This will trigger reactivity for positions
}, { deep: true });

// Emits
const emit = defineEmits<{
  showUserSetup: []
}>();
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>