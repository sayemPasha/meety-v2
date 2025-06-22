<!-- Debug Panel Component -->
<template>
  <div class="fixed bottom-4 right-4 z-50">
    <!-- Toggle Button -->
    <button
      v-if="!showPanel"
      @click="showPanel = true"
      class="bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-red-600 transition-colors"
    >
      🐛 Debug
    </button>

    <!-- Debug Panel -->
    <div
      v-if="showPanel"
      class="bg-white rounded-lg shadow-2xl border border-gray-200 w-96 max-h-96 overflow-hidden"
    >
      <!-- Header -->
      <div class="bg-red-500 text-white px-4 py-2 flex items-center justify-between">
        <h3 class="font-semibold">🐛 Debug Panel</h3>
        <button @click="showPanel = false" class="text-white hover:text-gray-200">✕</button>
      </div>

      <!-- Content -->
      <div class="p-4 space-y-3 max-h-80 overflow-y-auto">
        <!-- Quick Actions -->
        <div class="space-y-2">
          <h4 class="font-semibold text-gray-800">Quick Actions</h4>
          <div class="grid grid-cols-2 gap-2">
            <button
              @click="testPermissions"
              class="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600"
              :disabled="isLoading"
            >
              🛡️ Test Permissions
            </button>
            <button
              @click="testDirectDelete"
              class="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600"
              :disabled="isLoading"
            >
              🗑️ Test Delete
            </button>
            <button
              @click="checkCounts"
              class="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600"
              :disabled="isLoading"
            >
              📊 Check Counts
            </button>
            <button
              @click="clearAllSuggestions"
              class="bg-orange-500 text-white px-3 py-1 rounded text-sm hover:bg-orange-600"
              :disabled="isLoading"
            >
              🧹 Clear All
            </button>
          </div>
        </div>

        <!-- Session Info -->
        <div v-if="store.currentSession">
          <h4 class="font-semibold text-gray-800">Session Info</h4>
          <div class="text-xs text-gray-600 space-y-1">
            <div>ID: {{ store.currentSession.id.slice(0, 8) }}...</div>
            <div>Users: {{ store.currentSession.users.length }}</div>
            <div>Connected: {{ store.connectedUsers.length }}</div>
            <div>Suggestions: {{ store.currentSession.meetupSuggestions.length }}</div>
          </div>
        </div>

        <!-- Debug Output -->
        <div v-if="debugOutput">
          <h4 class="font-semibold text-gray-800">Debug Output</h4>
          <div class="bg-gray-900 text-green-400 p-3 rounded text-xs font-mono max-h-32 overflow-y-auto border">
            <pre class="text-green-400">{{ debugOutput }}</pre>
          </div>
        </div>

        <!-- Loading Indicator -->
        <div v-if="isLoading" class="text-center py-2">
          <div class="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
          <div class="text-sm text-gray-600 mt-1">Running debug test...</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useMeetyStore } from '@/stores/meetyStore';
import { supabase } from '@/lib/supabase';

const store = useMeetyStore();

const showPanel = ref(false);
const isLoading = ref(false);
const debugOutput = ref('');

const log = (message: string) => {
  console.log(message);
  debugOutput.value += message + '\n';
};

const clearLog = () => {
  debugOutput.value = '';
};

const testPermissions = async () => {
  if (!store.currentSession) {
    log('❌ No active session');
    return;
  }

  isLoading.value = true;
  clearLog();
  
  try {
    log('🛡️ TESTING PERMISSIONS...\n');

    // Test 1: SELECT
    log('🧪 TEST 1: SELECT permission...');
    const { data: selectData, error: selectError } = await supabase
      .from('meetup_suggestions')
      .select('*')
      .eq('session_id', store.currentSession.id);

    if (selectError) {
      log(`❌ SELECT failed: ${selectError.message}`);
    } else {
      log(`✅ SELECT works: Found ${selectData?.length || 0} suggestions`);
    }

    // Test 2: INSERT
    log('\n🧪 TEST 2: INSERT permission...');
    const { data: insertData, error: insertError } = await supabase
      .from('meetup_suggestions')
      .insert({
        session_id: store.currentSession.id,
        name: 'PERMISSION_TEST_SUGGESTION',
        type: 'test',
        location_lat: 40.7128,
        location_lng: -74.0060,
        location_address: 'Test Address',
        rating: 5.0
      })
      .select()
      .single();

    if (insertError) {
      log(`❌ INSERT failed: ${insertError.message}`);
    } else {
      log(`✅ INSERT works: Created suggestion ${insertData?.id}`);
    }

    // Test 3: DELETE single
    log('\n🧪 TEST 3: DELETE permission...');
    const { error: deleteError } = await supabase
      .from('meetup_suggestions')
      .delete()
      .eq('name', 'PERMISSION_TEST_SUGGESTION')
      .eq('session_id', store.currentSession.id);

    if (deleteError) {
      log(`❌ DELETE failed: ${deleteError.message}`);
    } else {
      log('✅ DELETE works');
    }

    // Test 4: Bulk DELETE
    log('\n🧪 TEST 4: Bulk DELETE permission...');
    const { error: bulkDeleteError } = await supabase
      .from('meetup_suggestions')
      .delete()
      .eq('session_id', store.currentSession.id)
      .eq('type', 'test');

    if (bulkDeleteError) {
      log(`❌ Bulk DELETE failed: ${bulkDeleteError.message}`);
    } else {
      log('✅ Bulk DELETE works');
    }

    log('\n🎯 PERMISSION SUMMARY:');
    log(`SELECT: ${selectError ? '❌' : '✅'}`);
    log(`INSERT: ${insertError ? '❌' : '✅'}`);
    log(`DELETE: ${deleteError ? '❌' : '✅'}`);
    log(`BULK DELETE: ${bulkDeleteError ? '❌' : '✅'}`);

  } catch (err) {
    log(`❌ Permission test failed: ${err}`);
  } finally {
    isLoading.value = false;
  }
};

const testDirectDelete = async () => {
  if (!store.currentSession) {
    log('❌ No active session');
    return;
  }

  isLoading.value = true;
  clearLog();
  
  try {
    log('🗑️ TESTING DIRECT DELETE...\n');

    // Get current count
    const { data: beforeData, error: beforeError } = await supabase
      .from('meetup_suggestions')
      .select('id, name')
      .eq('session_id', store.currentSession.id);

    if (beforeError) {
      log(`❌ Error getting before count: ${beforeError.message}`);
      return;
    }

    log(`📊 Before: ${beforeData?.length || 0} suggestions`);
    if (beforeData && beforeData.length > 0) {
      log('Suggestion IDs:');
      beforeData.forEach((s, i) => {
        log(`  ${i + 1}. ${s.name} (${s.id.slice(0, 8)})`);
      });
    }

    // Attempt direct delete
    log('\n🗑️ Attempting direct bulk delete...');
    const { error: deleteError, count } = await supabase
      .from('meetup_suggestions')
      .delete({ count: 'exact' })
      .eq('session_id', store.currentSession.id);

    if (deleteError) {
      log(`❌ Direct delete failed: ${deleteError.message}`);
    } else {
      log(`✅ Direct delete executed: ${count || 0} rows affected`);
    }

    // Check after count
    const { data: afterData, error: afterError } = await supabase
      .from('meetup_suggestions')
      .select('id, name')
      .eq('session_id', store.currentSession.id);

    if (afterError) {
      log(`❌ Error getting after count: ${afterError.message}`);
    } else {
      log(`📊 After: ${afterData?.length || 0} suggestions`);
      const actuallyDeleted = (beforeData?.length || 0) - (afterData?.length || 0);
      log(`🧮 Actually deleted: ${actuallyDeleted} suggestions`);
      
      if (actuallyDeleted === 0 && (beforeData?.length || 0) > 0) {
        log('❌ FAILED: No suggestions were actually deleted');
        log('This suggests a permission or caching issue');
      } else if (actuallyDeleted > 0) {
        log('✅ SUCCESS: Suggestions were deleted');
      }
    }

  } catch (err) {
    log(`❌ Direct delete test failed: ${err}`);
  } finally {
    isLoading.value = false;
  }
};

const checkCounts = async () => {
  if (!store.currentSession) {
    log('❌ No active session');
    return;
  }

  isLoading.value = true;
  clearLog();
  
  try {
    log('📊 CHECKING COUNTS & SYNC...\n');

    // Database count
    const { data: dbData, error: dbError } = await supabase
      .from('meetup_suggestions')
      .select('id, name, created_at')
      .eq('session_id', store.currentSession.id)
      .order('created_at', { ascending: true });

    if (dbError) {
      log(`❌ Database query failed: ${dbError.message}`);
      return;
    }

    // Local cache count
    const localCount = store.currentSession.meetupSuggestions.length;
    const dbCount = dbData?.length || 0;

    log(`Database count: ${dbCount}`);
    log(`Local cache count: ${localCount}`);
    log(`Session ID: ${store.currentSession.id}`);

    if (dbData && dbData.length > 0) {
      log('\nDatabase suggestions:');
      dbData.forEach((s, i) => {
        log(`${i + 1}. ${s.name} (${s.id.slice(0, 8)}) - ${s.created_at}`);
      });
    }

    if (dbCount === localCount) {
      log('\n✅ SYNC OK: Database and local cache match');
    } else {
      log('\n⚠️ SYNC ISSUE: Database and local cache differ');
      log('This might indicate a real-time subscription problem');
    }

  } catch (err) {
    log(`❌ Count check failed: ${err}`);
  } finally {
    isLoading.value = false;
  }
};

const clearAllSuggestions = async () => {
  if (!store.currentSession) {
    log('❌ No active session');
    return;
  }

  isLoading.value = true;
  clearLog();
  
  try {
    log('🧹 CLEARING ALL SUGGESTIONS...\n');

    const { error, count } = await supabase
      .from('meetup_suggestions')
      .delete({ count: 'exact' })
      .eq('session_id', store.currentSession.id);

    if (error) {
      log(`❌ Clear failed: ${error.message}`);
    } else {
      log(`✅ Cleared ${count || 0} suggestions`);
      
      // Reload session data
      log('🔄 Reloading session data...');
      // Trigger store reload if method exists
      if (typeof store.loadSessionData === 'function') {
        await store.loadSessionData(store.currentSession.id);
      }
      log('✅ Session data reloaded');
    }

  } catch (err) {
    log(`❌ Clear all failed: ${err}`);
  } finally {
    isLoading.value = false;
  }
};
</script>

<style scoped>
pre {
  white-space: pre-wrap;
  word-wrap: break-word;
  color: #4ade80 !important; /* Force green text */
}

/* Ensure debug output is visible */
.debug-output {
  background-color: #1f2937 !important;
  color: #4ade80 !important;
}
</style>
</template>