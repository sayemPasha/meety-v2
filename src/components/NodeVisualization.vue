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

    <!-- Meetup Suggestions Modal -->
    <div
      v-if="showMeetupModal"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      @click="showMeetupModal = false"
    >
      <div 
        class="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-2xl"
        @click.stop
      >
        <div class="p-6 border-b border-gray-200">
          <h2 class="text-2xl font-bold text-gray-800 mb-2">🎯 Suggested Meetup Locations</h2>
          <p class="text-gray-600">Based on everyone's preferences and locations</p>
        </div>
        
        <div class="p-6 space-y-4 max-h-96 overflow-y-auto">
          <div
            v-for="suggestion in meetupSuggestions"
            :key="suggestion.id"
            class="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200 hover:shadow-lg transition-all duration-200 cursor-pointer"
          >
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <h3 class="font-semibold text-lg text-gray-800 mb-1">{{ suggestion.name }}</h3>
                <p class="text-gray-600 text-sm mb-2">{{ suggestion.location.address }}</p>
                <div class="flex items-center space-x-4 text-sm">
                  <span class="flex items-center space-x-1">
                    <span class="text-yellow-500">⭐</span>
                    <span class="font-medium">{{ suggestion.rating }}</span>
                  </span>
                  <span class="flex items-center space-x-1">
                    <span class="text-blue-500">📍</span>
                    <span>{{ suggestion.averageDistance }}km avg</span>
                  </span>
                </div>
              </div>
              <div class="text-2xl ml-4">
                {{ getActivityIcon(suggestion.type) }}
              </div>
            </div>
          </div>
        </div>
        
        <div class="px-6 py-4 bg-gray-50 border-t border-gray-200">
          <button
            class="w-full bg-gradient-to-r from-cosmic-500 to-space-600 text-white py-3 px-6 rounded-xl font-semibold hover:shadow-lg transition-all duration-200"
            @click="showMeetupModal = false"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useMeetyStore } from '@/stores/meetyStore';
import { ACTIVITY_TYPES } from '@/types';

const store = useMeetyStore();

// Reactive refs
const containerWidth = ref(800);
const containerHeight = ref(600);
const centerNode = ref<HTMLElement>();
const userNodes = ref<HTMLElement[]>([]);
const showMeetupModal = ref(false);

// Computed properties
const users = computed(() => store.currentSession?.users || []);
const currentUserId = computed(() => store.currentUserId);
const canGenerateMeetups = computed(() => store.canGenerateMeetups);
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
    await store.generateMeetupSuggestions();
    showMeetupModal.value = true;
  }
};

const handleUserNodeClick = (user: any) => {
  if (user.id === currentUserId.value && !user.connected) {
    // Emit event to parent to show location/activity selection
    emit('showUserSetup');
  }
};

const getActivityIcon = (type: string) => {
  const activity = ACTIVITY_TYPES.find(a => a.id === type);
  return activity?.icon || '📍';
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
/* Removed all connection-related styles for cleaner look */
</style>