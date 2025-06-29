<template>
  <div class="min-h-screen">
    <!-- Header -->
    <header class="relative z-30 p-6">
      <div class="max-w-7xl mx-auto flex items-center justify-between">
        <div class="flex items-center space-x-3">
          <div class="relative">
            <!-- Meety Logo with Smaller Glow Effect -->
            <div class="absolute inset-0 bg-gradient-to-br from-pink-400 to-purple-600 rounded-full blur-md opacity-50 animate-pulse-glow"></div>
            <div class="relative w-20 h-20 flex items-center justify-center">
              <img 
                src="/meety-transparent.png" 
                alt="Meety Logo" 
                class="w-full h-full object-contain drop-shadow-lg"
              />
            </div>
          </div>
          <div>
            <p class="text-sm text-gray-300">Find the perfect meetup spot</p>
          </div>
        </div>
        
        <div v-if="store.currentSession" class="text-right">
          <div class="text-sm text-gray-300">Session ID</div>
          <div class="text-xs text-gray-400 font-mono">{{ store.currentSession.id.slice(0, 8) }}...</div>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="relative z-20 px-6 pb-8">
      <div class="max-w-7xl mx-auto">
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <!-- Node Visualization Panel -->
          <div class="lg:col-span-2">
            <div class="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-6 shadow-2xl">
              <div class="node-container relative h-[500px] md:h-[600px]">
                <NodeVisualization @show-user-setup="showLocationSelector = true" />
              </div>
            </div>
          </div>

          <!-- Control Panel -->
          <div class="space-y-6">
            
            <!-- User Status -->
            <div class="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 shadow-xl">
              <div class="flex items-center space-x-3 mb-4">
                <div class="w-10 h-10 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center">
                  <span class="text-white">👤</span>
                </div>
                <div>
                  <h3 class="font-bold text-lg text-white">Your Status</h3>
                  <p class="text-sm text-gray-300">{{ currentUser?.name || 'Guest User' }}</p>
                </div>
              </div>

              <div class="space-y-3">
                <div class="flex items-center space-x-3">
                  <span class="text-lg">📍</span>
                  <div class="flex-1">
                    <div class="text-sm text-gray-300">Location</div>
                    <div class="text-white font-medium">
                      {{ currentUser?.location?.address || 'Not set' }}
                    </div>
                  </div>
                </div>
                
                <div class="flex items-center space-x-3">
                  <span class="text-lg">{{ getActivityIcon(currentUser?.activity) }}</span>
                  <div class="flex-1">
                    <div class="text-sm text-gray-300">Activity</div>
                    <div class="text-white font-medium">
                      {{ getActivityName(currentUser?.activity) || 'Not selected' }}
                    </div>
                  </div>
                </div>
              </div>

              <button
                v-if="!currentUser?.connected"
                class="w-full mt-4 bg-gradient-to-r from-cosmic-500 to-space-600 text-white py-3 px-4 rounded-xl font-semibold hover:shadow-lg transition-all duration-200"
                @click="showLocationSelector = true"
              >
                Set Location & Activity
              </button>
            </div>

            <!-- Share Panel -->
            <SharePanel v-if="store.shouldShowShareLink" />

            <!-- Instructions -->
            <div class="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 shadow-xl">
              <h3 class="font-bold text-lg text-white mb-3">How it works</h3>
              <div class="space-y-3 text-sm text-gray-300">
                <div class="flex items-start space-x-3">
                  <span class="text-stellar-400 font-bold">1.</span>
                  <span>Set your location and preferred activity</span>
                </div>
                <div class="flex items-start space-x-3">
                  <span class="text-stellar-400 font-bold">2.</span>
                  <span>Share the link with friends to join</span>
                </div>
                <div class="flex items-start space-x-3">
                  <span class="text-stellar-400 font-bold">3.</span>
                  <span>When everyone's ready, click the center node</span>
                </div>
                <div class="flex items-start space-x-3">
                  <span class="text-stellar-400 font-bold">4.</span>
                  <span>Get personalized meetup suggestions!</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </main>

    <!-- Location Selector Modal -->
    <LocationSelector
      v-if="showLocationSelector"
      @close="showLocationSelector = false"
    />

    <!-- Loading Overlay -->
    <div
      v-if="store.isLoading"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    >
      <div class="bg-white rounded-2xl p-8 text-center shadow-2xl">
        <div class="w-16 h-16 bg-gradient-to-br from-cosmic-500 to-space-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-spin">
          <span class="text-white text-2xl">🌟</span>
        </div>
        <h3 class="text-lg font-semibold text-gray-800 mb-2">{{ loadingMessage }}</h3>
        <p class="text-gray-600">Please wait...</p>
      </div>
    </div>

    <!-- Error Message -->
    <div
      v-if="store.error"
      class="fixed top-4 right-4 bg-red-500 text-white p-4 rounded-lg shadow-lg z-50"
    >
      <div class="flex items-center space-x-2">
        <span>❌</span>
        <span>{{ store.error }}</span>
        <button @click="store.error = null" class="ml-2 text-white hover:text-gray-200">
          ✕
        </button>
      </div>
    </div>

    <!-- Debug Panel -->
    <DebugPanel />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useMeetyStore } from '@/stores/meetyStore';
import { ACTIVITY_TYPES } from '@/types';
import NodeVisualization from '@/components/NodeVisualization.vue';
import LocationSelector from '@/components/LocationSelector.vue';
import SharePanel from '@/components/SharePanel.vue';
import DebugPanel from '@/components/DebugPanel.vue';

const store = useMeetyStore();

// Reactive refs
const showLocationSelector = ref(false);

// Computed properties
const currentUser = computed(() => store.currentUser);

const loadingMessage = computed(() => {
  if (store.isLoading) {
    if (!store.currentSession) {
      return 'Creating session...';
    } else if (store.canGenerateMeetups) {
      return 'Finding perfect spots...';
    } else {
      return 'Loading...';
    }
  }
  return '';
});

// Methods
const getActivityIcon = (activityId: string | null | undefined) => {
  if (!activityId) return '🎯';
  const activity = ACTIVITY_TYPES.find(a => a.id === activityId);
  return activity?.icon || '🎯';
};

const getActivityName = (activityId: string | null | undefined) => {
  if (!activityId) return null;
  const activity = ACTIVITY_TYPES.find(a => a.id === activityId);
  return activity?.name || null;
};

// Lifecycle
onMounted(async () => {
  // Check if we have a session ID in URL
  const urlParams = new URLSearchParams(window.location.search);
  const sessionId = urlParams.get('session');
  
  if (sessionId) {
    await store.joinSession(sessionId);
  } else {
    await store.createSession();
  }
});

onUnmounted(() => {
  store.cleanup();
});
</script>

<style scoped>
.node-container {
  background: radial-gradient(circle at center, rgba(168, 85, 168, 0.1) 0%, transparent 70%);
}
</style>