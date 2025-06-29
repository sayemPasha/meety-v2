<template>
  <div class="bg-gradient-to-r from-stellar-50 to-nebula-50 border border-stellar-200 rounded-2xl p-6 shadow-lg">
    <div class="flex items-center space-x-3 mb-4">
      <div class="w-12 h-12 bg-gradient-to-br from-stellar-400 to-stellar-600 rounded-full flex items-center justify-center">
        <span class="text-white text-xl">🔗</span>
      </div>
      <div>
        <h3 class="font-bold text-lg text-gray-800">Share with Friends</h3>
        <p class="text-sm text-gray-600">Invite others to join your meetup</p>
      </div>
    </div>

    <div class="space-y-4">
      <!-- Shareable Link -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          Shareable Link
        </label>
        <div class="flex space-x-2">
          <input
            ref="linkInput"
            :value="shareLink"
            readonly
            class="flex-1 px-4 py-3 bg-white border border-gray-300 rounded-xl text-sm text-gray-600 focus:outline-none"
          />
          <button
            class="px-6 py-3 bg-gradient-to-r from-cosmic-500 to-space-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all duration-200"
            @click="copyLink"
          >
            {{ copied ? '✓ Copied!' : 'Copy' }}
          </button>
        </div>
      </div>

      <!-- Connected Users -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-3">
          Connected Users ({{ connectedUsers.length }})
        </label>
        <div class="space-y-2">
          <div
            v-for="user in allUsers"
            :key="user.id"
            class="flex items-center space-x-3 p-3 rounded-xl border"
            :class="user.connected 
              ? 'bg-white border-emerald-300 shadow-sm' 
              : 'bg-gray-50 border-gray-300'"
          >
            <div
              class="w-10 h-10 rounded-full flex items-center justify-center"
              :class="user.connected ? 'bg-emerald-500' : 'bg-gray-400'"
            >
              <span class="text-white text-sm font-semibold">{{ user.connected ? '✓' : '⏳' }}</span>
            </div>
            <div class="flex-1">
              <div class="font-semibold text-sm text-gray-900">{{ user.name }}</div>
              <div class="text-xs font-medium"
                   :class="user.connected ? 'text-emerald-700' : 'text-gray-600'">
                {{ user.connected ? 'Ready to meet!' : 'Setting up location...' }}
              </div>
            </div>
            <div v-if="user.activity" class="flex items-center space-x-1">
              <span class="text-lg">{{ getActivityIcon(user.activity) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Share Buttons -->
      <div class="grid grid-cols-2 gap-3">
        <button
          class="flex items-center justify-center space-x-2 py-3 px-4 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-600 transition-all duration-200"
          @click="shareViaWhatsApp"
        >
          <span>📱</span>
          <span>WhatsApp</span>
        </button>
        <button
          class="flex items-center justify-center space-x-2 py-3 px-4 bg-gray-700 text-white rounded-xl font-semibold hover:bg-gray-800 transition-all duration-200"
          @click="shareViaEmail"
        >
          <span>📧</span>
          <span>Email</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useMeetyStore } from '@/stores/meetyStore';
import { ACTIVITY_TYPES } from '@/types';

const store = useMeetyStore();

// Reactive refs
const copied = ref(false);
const linkInput = ref<HTMLInputElement>();

// Computed properties
const shareLink = computed(() => store.getShareableLink());
const connectedUsers = computed(() => store.connectedUsers);
const allUsers = computed(() => store.currentSession?.users || []);

// Methods
const copyLink = async () => {
  try {
    await navigator.clipboard.writeText(shareLink.value);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch (error) {
    // Fallback for browsers that don't support clipboard API
    if (linkInput.value) {
      linkInput.value.select();
      document.execCommand('copy');
      copied.value = true;
      setTimeout(() => {
        copied.value = false;
      }, 2000);
    }
  }
};

const shareViaWhatsApp = () => {
  const message = encodeURIComponent(
    `Join me for a meetup! Click this link to add your location: ${shareLink.value}`
  );
  window.open(`https://wa.me/?text=${message}`, '_blank');
};

const shareViaEmail = () => {
  const subject = encodeURIComponent('Join my Meety session!');
  const body = encodeURIComponent(
    `Hi! I'm organizing a meetup and would love for you to join.\n\nClick this link to add your location and preferences: ${shareLink.value}\n\nSee you soon!`
  );
  window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
};

const getActivityIcon = (activityId: string) => {
  const activity = ACTIVITY_TYPES.find(a => a.id === activityId);
  return activity?.icon || '📍';
};
</script>