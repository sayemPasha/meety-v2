import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/lib/supabase';
import { generateMeetupSuggestions, calculateOptimalMeetingPoint } from '@/utils/meetupCalculator';
import type { User, Session, MeetupSuggestion } from '@/types';
import type { RealtimeChannel } from '@supabase/supabase-js';

export const useMeetyStore = defineStore('meety', () => {
  const currentSession = ref<Session | null>(null);
  const currentUserId = ref<string>('');
  const currentUserDbId = ref<string>('');
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const realtimeChannel = ref<RealtimeChannel | null>(null);
  const lastSuggestionHash = ref<string>(''); // Track when suggestions need updating
  const lastUserCount = ref<number>(0); // Track user count changes
  const isGeneratingSuggestions = ref(false); // Prevent concurrent generation

  // Computed properties
  const connectedUsers = computed(() => 
    currentSession.value?.users.filter(user => user.connected) || []
  );

  const currentUser = computed(() => 
    currentSession.value?.users.find(user => user.id === currentUserId.value)
  );

  const canGenerateMeetups = computed(() => 
    connectedUsers.value.length >= 2 && 
    connectedUsers.value.every(user => user.location && user.activity)
  );

  const shouldShowShareLink = computed(() => 
    currentUser.value?.location && currentUser.value?.activity
  );

  // Generate a hash of user locations and activities to detect changes
  const getUserConfigHash = () => {
    const allUsers = currentSession.value?.users || [];
    const userData = allUsers
      .filter(user => user.connected && user.location && user.activity) // Only include fully configured users
      .map(user => ({
        id: user.id,
        lat: user.location!.lat,
        lng: user.location!.lng,
        activity: user.activity
      }))
      .sort((a, b) => a.id.localeCompare(b.id)); // Sort for consistent hash
    
    return JSON.stringify(userData);
  };

  // Check if suggestions are outdated - UPDATED LOGIC
  const areSuggestionsOutdated = () => {
    if (!currentSession.value) return false;
    
    const currentHash = getUserConfigHash();
    const hasValidSuggestions = currentSession.value.meetupSuggestions.length > 0;
    const currentUserCount = currentSession.value.users.length;
    
    // Suggestions are outdated if:
    // 1. User configuration changed (location/activity)
    // 2. Number of users changed (someone joined/left)
    // 3. We have no suggestions but we should (users are ready)
    return (hasValidSuggestions && (currentHash !== lastSuggestionHash.value || currentUserCount !== lastUserCount.value)) ||
           (!hasValidSuggestions && canGenerateMeetups.value && currentHash !== '');
  };

  // Clear meetup suggestions from database - FIXED TO PROPERLY CLEAR ALL
  const clearMeetupSuggestions = async (sessionId: string) => {
    try {
      console.log('🧹 Clearing ALL existing suggestions from database for session:', sessionId);
      
      // First, clear local suggestions immediately to prevent UI showing old data
      if (currentSession.value) {
        currentSession.value.meetupSuggestions = [];
        console.log('🧹 Cleared local suggestions cache immediately');
      }

      // Delete ALL suggestions for this session from database
      const { error: deleteError, count } = await supabase
        .from('meetup_suggestions')
        .delete({ count: 'exact' })
        .eq('session_id', sessionId);

      if (deleteError) {
        console.error('❌ Error clearing meetup suggestions:', deleteError);
        throw deleteError;
      } else {
        console.log(`✅ Successfully cleared ${count || 0} old meetup suggestions from database`);
      }
      
    } catch (err) {
      console.error('❌ Error in clearMeetupSuggestions:', err);
      throw err;
    }
  };

  // Real-time subscription setup
  const setupRealtimeSubscription = (sessionId: string) => {
    if (realtimeChannel.value) {
      realtimeChannel.value.unsubscribe();
    }

    realtimeChannel.value = supabase
      .channel(`session-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'session_users',
          filter: `session_id=eq.${sessionId}`,
        },
        async (payload) => {
          console.log('Real-time session_users update:', payload);
          await loadSessionData(sessionId);
          
          // Mark suggestions as outdated when user data changes
          console.log('🔄 User data changed, marking suggestions as outdated');
          lastSuggestionHash.value = ''; // Mark as outdated
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'meetup_suggestions',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          console.log('Meetup suggestions update:', payload);
          loadMeetupSuggestions(sessionId);
        }
      )
      .subscribe();
  };

  // Load session data from Supabase
  const loadSessionData = async (sessionId: string) => {
    try {
      // Load session
      const { data: sessionData, error: sessionError } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('is_active', true)
        .single();

      if (sessionError) throw sessionError;

      // Load session users
      const { data: usersData, error: usersError } = await supabase
        .from('session_users')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at');

      if (usersError) throw usersError;

      // Load meetup suggestions
      const { data: suggestionsData, error: suggestionsError } = await supabase
        .from('meetup_suggestions')
        .select('*')
        .eq('session_id', sessionId)
        .order('distance', { ascending: true }); // Order by distance to center

      if (suggestionsError) throw suggestionsError;

      // Transform data to match our types
      const users: User[] = usersData.map(user => ({
        id: user.id,
        name: user.name,
        location: user.location_lat && user.location_lng ? {
          lat: user.location_lat,
          lng: user.location_lng,
          address: user.location_address || ''
        } : null,
        activity: user.activity,
        connected: user.connected,
        color: user.color
      }));

      const suggestions: MeetupSuggestion[] = suggestionsData.map(suggestion => ({
        id: suggestion.id,
        name: suggestion.name,
        type: suggestion.type,
        location: {
          lat: suggestion.location_lat,
          lng: suggestion.location_lng,
          address: suggestion.location_address
        },
        rating: suggestion.rating,
        distance: suggestion.distance,
        averageDistance: suggestion.average_distance
      }));

      currentSession.value = {
        id: sessionData.id,
        createdAt: new Date(sessionData.created_at),
        users,
        meetupSuggestions: suggestions
      };

      // Update tracking variables
      if (suggestions.length > 0) {
        lastSuggestionHash.value = getUserConfigHash();
        console.log('📝 Updated suggestion hash:', lastSuggestionHash.value);
      }
      lastUserCount.value = users.length;

    } catch (err) {
      console.error('Error loading session data:', err);
      error.value = 'Failed to load session data';
    }
  };

  // Load meetup suggestions
  const loadMeetupSuggestions = async (sessionId: string) => {
    try {
      const { data, error: suggestionsError } = await supabase
        .from('meetup_suggestions')
        .select('*')
        .eq('session_id', sessionId)
        .order('distance', { ascending: true }); // Order by distance to center

      if (suggestionsError) throw suggestionsError;

      const suggestions: MeetupSuggestion[] = data.map(suggestion => ({
        id: suggestion.id,
        name: suggestion.name,
        type: suggestion.type,
        location: {
          lat: suggestion.location_lat,
          lng: suggestion.location_lng,
          address: suggestion.location_address
        },
        rating: suggestion.rating,
        distance: suggestion.distance,
        averageDistance: suggestion.average_distance
      }));

      if (currentSession.value) {
        currentSession.value.meetupSuggestions = suggestions;
        
        // Update hash if we have suggestions
        if (suggestions.length > 0) {
          lastSuggestionHash.value = getUserConfigHash();
          lastUserCount.value = currentSession.value.users.length;
        }
      }
    } catch (err) {
      console.error('Error loading meetup suggestions:', err);
    }
  };

  // Actions
  const createSession = async () => {
    try {
      isLoading.value = true;
      
      // Create session in Supabase
      const { data: sessionData, error: sessionError } = await supabase
        .from('sessions')
        .insert({
          is_active: true
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      // Create user in session
      const userId = uuidv4();
      const { data: userData, error: userError } = await supabase
        .from('session_users')
        .insert({
          session_id: sessionData.id,
          name: 'User 1',
          connected: false,
          color: getRandomColor()
        })
        .select()
        .single();

      if (userError) throw userError;

      currentUserId.value = userData.id;
      currentUserDbId.value = userData.id;

      // Load session data
      await loadSessionData(sessionData.id);
      
      // Setup real-time subscription
      setupRealtimeSubscription(sessionData.id);

      // Update URL
      const url = new URL(window.location.href);
      url.searchParams.set('session', sessionData.id);
      window.history.replaceState({}, '', url.toString());

    } catch (err) {
      console.error('Error creating session:', err);
      error.value = 'Failed to create session';
    } finally {
      isLoading.value = false;
    }
  };

  const joinSession = async (sessionId: string) => {
    try {
      isLoading.value = true;

      // Load existing session data first
      await loadSessionData(sessionId);

      if (!currentSession.value) {
        throw new Error('Session not found');
      }

      // Create new user in session
      const userNumber = currentSession.value.users.length + 1;
      const { data: userData, error: userError } = await supabase
        .from('session_users')
        .insert({
          session_id: sessionId,
          name: `User ${userNumber}`,
          connected: false,
          color: getRandomColor()
        })
        .select()
        .single();

      if (userError) throw userError;

      currentUserId.value = userData.id;
      currentUserDbId.value = userData.id;

      // Reload session data to include new user
      await loadSessionData(sessionId);
      
      // Setup real-time subscription
      setupRealtimeSubscription(sessionId);

      // CLEAR EXISTING SUGGESTIONS when new user joins
      console.log('🆕 New user joined, clearing existing suggestions');
      await clearMeetupSuggestions(sessionId);
      lastSuggestionHash.value = '';
      lastUserCount.value = currentSession.value?.users.length || 0;

    } catch (err) {
      console.error('Error joining session:', err);
      error.value = 'Failed to join session';
    } finally {
      isLoading.value = false;
    }
  };

  const updateUserLocation = async (location: { lat: number; lng: number; address: string }) => {
    if (!currentUserDbId.value || !currentSession.value) return;

    try {
      const { error: updateError } = await supabase
        .from('session_users')
        .update({
          location_lat: location.lat,
          location_lng: location.lng,
          location_address: location.address,
          updated_at: new Date().toISOString()
        })
        .eq('id', currentUserDbId.value);

      if (updateError) throw updateError;

      // Update local state
      if (currentUser.value) {
        currentUser.value.location = location;
      }

      // CLEAR EXISTING SUGGESTIONS when user location changes
      console.log('📍 User location updated, clearing existing suggestions');
      await clearMeetupSuggestions(currentSession.value.id);
      lastSuggestionHash.value = '';

      await checkUserConnection();
    } catch (err) {
      console.error('Error updating user location:', err);
      error.value = 'Failed to update location';
    }
  };

  const updateUserActivity = async (activity: string) => {
    if (!currentUserDbId.value || !currentSession.value) return;

    try {
      const { error: updateError } = await supabase
        .from('session_users')
        .update({
          activity: activity,
          updated_at: new Date().toISOString()
        })
        .eq('id', currentUserDbId.value);

      if (updateError) throw updateError;

      // Update local state
      if (currentUser.value) {
        currentUser.value.activity = activity;
      }

      // CLEAR EXISTING SUGGESTIONS when user activity changes
      console.log('🎯 User activity updated, clearing existing suggestions');
      await clearMeetupSuggestions(currentSession.value.id);
      lastSuggestionHash.value = '';

      await checkUserConnection();
    } catch (err) {
      console.error('Error updating user activity:', err);
      error.value = 'Failed to update activity';
    }
  };

  const checkUserConnection = async () => {
    if (!currentUser.value || !currentUserDbId.value) return;

    const isConnected = !!(currentUser.value.location && currentUser.value.activity);
    
    if (isConnected !== currentUser.value.connected) {
      try {
        const { error: updateError } = await supabase
          .from('session_users')
          .update({
            connected: isConnected,
            updated_at: new Date().toISOString()
          })
          .eq('id', currentUserDbId.value);

        if (updateError) throw updateError;

        // Update local state
        currentUser.value.connected = isConnected;
        
        console.log('🔗 User connection status changed to:', isConnected);
      } catch (err) {
        console.error('Error updating connection status:', err);
      }
    }
  };

  const generateMeetupSuggestionsAction = async () => {
    if (!canGenerateMeetups.value || !currentSession.value) {
      console.log('❌ Cannot generate meetups - requirements not met');
      console.log('Can generate:', canGenerateMeetups.value);
      console.log('Connected users:', connectedUsers.value.length);
      console.log('Users with location and activity:', connectedUsers.value.filter(u => u.location && u.activity).length);
      return;
    }

    // Prevent concurrent generation
    if (isGeneratingSuggestions.value) {
      console.log('⏳ Already generating suggestions, skipping...');
      return;
    }

    isGeneratingSuggestions.value = true;
    isLoading.value = true;
    
    try {
      console.log('🎯 Starting fresh meetup suggestion generation...');
      
      // CRITICAL: ALWAYS clear existing suggestions FIRST to prevent accumulation
      console.log('🧹 STEP 1: Clearing ALL existing suggestions for fresh generation...');
      await clearMeetupSuggestions(currentSession.value.id);
      
      // Wait a moment to ensure database operation completes
      await new Promise(resolve => setTimeout(resolve, 500));

      console.log('🎯 STEP 2: Calculating optimal meetup locations...');
      console.log('Connected users:', connectedUsers.value.map(u => ({
        name: u.name,
        location: u.location,
        activity: u.activity
      })));

      // Calculate optimal meeting point
      const optimalPoint = calculateOptimalMeetingPoint(currentSession.value.users);
      console.log('📍 Optimal meeting point (MEDIAN):', optimalPoint);

      // Generate suggestions using the updated algorithm
      const calculatedSuggestions = await generateMeetupSuggestions(currentSession.value.users);
      console.log('✨ Generated suggestions:', calculatedSuggestions.length, 'places');
      
      if (calculatedSuggestions.length === 0) {
        console.log('⚠️ No suggestions generated');
        return;
      }

      // Prepare data for database insertion
      const suggestionsToInsert = calculatedSuggestions.map(suggestion => ({
        session_id: currentSession.value!.id,
        name: suggestion.name,
        type: suggestion.type,
        location_lat: suggestion.location.lat,
        location_lng: suggestion.location.lng,
        location_address: suggestion.location.address,
        rating: suggestion.rating,
        distance: suggestion.distance, // Distance to center point
        average_distance: suggestion.averageDistance
      }));

      console.log('💾 STEP 3: Saving', suggestionsToInsert.length, 'NEW suggestions to database...');
      const { error: insertError, count } = await supabase
        .from('meetup_suggestions')
        .insert(suggestionsToInsert)
        .select('id', { count: 'exact' });

      if (insertError) {
        console.error('❌ Error inserting suggestions:', insertError);
        throw insertError;
      }

      console.log(`✅ Successfully saved ${count || suggestionsToInsert.length} NEW suggestions to database`);
      
      // Update the tracking variables
      lastSuggestionHash.value = getUserConfigHash();
      lastUserCount.value = currentSession.value.users.length;
      console.log('📝 Updated tracking after generation');

      // Reload suggestions to get them with proper IDs
      await loadMeetupSuggestions(currentSession.value.id);

      // Verify we have exactly the expected number of suggestions
      const finalCount = currentSession.value.meetupSuggestions.length;
      console.log(`🔍 Final verification: ${finalCount} suggestions in session (should be ~7)`);

    } catch (err) {
      console.error('❌ Error generating meetup suggestions:', err);
      error.value = 'Failed to generate meetup suggestions';
    } finally {
      isLoading.value = false;
      isGeneratingSuggestions.value = false;
    }
  };

  const getShareableLink = () => {
    if (!currentSession.value) return '';
    const baseUrl = window.location.origin + window.location.pathname;
    return `${baseUrl}?session=${currentSession.value.id}`;
  };

  const getRandomColor = () => {
    const colors = ['#3b82f6', '#8b5cf6', '#f59e0b', '#14b8a6', '#ef4444', '#ec4899'];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  // Cleanup function
  const cleanup = () => {
    if (realtimeChannel.value) {
      realtimeChannel.value.unsubscribe();
      realtimeChannel.value = null;
    }
  };

  return {
    // State
    currentSession,
    currentUserId,
    isLoading,
    error,
    
    // Computed
    connectedUsers,
    currentUser,
    canGenerateMeetups,
    shouldShowShareLink,
    areSuggestionsOutdated,
    
    // Actions
    createSession,
    joinSession,
    updateUserLocation,
    updateUserActivity,
    generateMeetupSuggestions: generateMeetupSuggestionsAction,
    getShareableLink,
    cleanup
  };
});