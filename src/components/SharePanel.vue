<template>
  <div class="bg-gradient-to-r from-pink-50 to-purple-50 border border-pink-200 rounded-2xl p-6 shadow-lg">
    <div class="flex items-center space-x-3 mb-4">
      <div class="w-12 h-12 bg-gradient-to-br from-pink-400 to-purple-600 rounded-full flex items-center justify-center">
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
            class="px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all duration-200"
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
          class="flex items-center justify-center space-x-2 py-3 px-4 bg-green-500 text-white rounded-xl font-semibold hover:bg-green-600 transition-all duration-200"
          @click="shareViaWhatsApp"
        >
          <!-- WhatsApp Icon -->
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
          </svg>
          <span>WhatsApp</span>
        </button>
        <button
          class="flex items-center justify-center space-x-2 py-3 px-4 bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600 transition-all duration-200"
          @click="shareViaEmail"
        >
          <!-- Gmail Icon -->
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"/>
          </svg>
          <span>Gmail</span>
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