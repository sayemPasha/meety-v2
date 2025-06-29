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
  
  // NEW: Infinite scroll state for suggestions
  const allGeneratedSuggestions = ref<MeetupSuggestion[]>([]); // Store all generated suggestions
  const displayedSuggestionsCount = ref(7); // How many to show initially
  const isLoadingMore = ref(false); // Loading state for infinite scroll
  const hasGeneratedAllSuggestions = ref(false); // Track if we've generated all possible suggestions
  const currentBatch = ref(1); // Track which batch we're on for generating more

  // Computed properties
  const connectedUsers = computed(() => 
    currentSession.value?.users.filter(user => user.connected) || []
  );

  const currentUser = computed(() => 
    currentSession.value?.users.find(user => user.id === currentUserId.value)
  );

  // UPDATED: Allow single user to generate meetups
  const canGenerateMeetups = computed(() => 
    connectedUsers.value.length >= 1 && 
    connectedUsers.value.every(user => user.location && user.activity)
  );

  const shouldShowShareLink = computed(() => 
    currentUser.value?.location && currentUser.value?.activity
  );

  // NEW: Computed for displayed suggestions (paginated)
  const displayedSuggestions = computed(() => 
    allGeneratedSuggestions.value.slice(0, displayedSuggestionsCount.value)
  );

  // NEW: Check if there are more suggestions to load or generate
  const hasMoreSuggestions = computed(() => {
    // First check if we have more already generated suggestions to display
    if (allGeneratedSuggestions.value.length > displayedSuggestionsCount.value) {
      return true;
    }
    
    // Then check if we can generate more suggestions
    return !hasGeneratedAllSuggestions.value && canGenerateMeetups.value;
  });

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

  // Clear meetup suggestions from database - SIMPLIFIED
  const clearMeetupSuggestions = async (sessionId: string) => {
    try {
      console.log('🧹 Clearing suggestions for session:', sessionId);
      
      // Clear local suggestions immediately
      if (currentSession.value) {
        currentSession.value.meetupSuggestions = [];
      }
      
      // NEW: Clear infinite scroll state
      allGeneratedSuggestions.value = [];
      displayedSuggestionsCount.value = 7;
      hasGeneratedAllSuggestions.value = false;
      currentBatch.value = 1;

      // Delete from database
      const { error: deleteError } = await supabase
        .from('meetup_suggestions')
        .delete()
        .eq('session_id', sessionId);

      if (deleteError) {
        console.error('❌ Error clearing suggestions:', deleteError);
        // Don't throw - continue with generation even if clearing fails
      } else {
        console.log('✅ Successfully cleared suggestions');
      }
      
    } catch (err) {
      console.error('❌ Error in clearMeetupSuggestions:', err);
      // Don't throw - continue with generation
    }
  };

  // Real-time subscription setup - FIXED
  const setupRealtimeSubscription = (sessionId: string) => {
    console.log('🔄 Setting up real-time subscription for session:', sessionId);
    
    // Clean up existing subscription
    if (realtimeChannel.value) {
      console.log('🧹 Cleaning up existing real-time subscription');
      realtimeChannel.value.unsubscribe();
      realtimeChannel.value = null;
    }

    // Create new channel with unique name
    const channelName = `session-${sessionId}-${Date.now()}`;
    console.log('📡 Creating real-time channel:', channelName);
    
    realtimeChannel.value = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'session_users',
          filter: `session_id=eq.${sessionId}`,
        },
        async (payload) => {
          console.log('📡 Real-time session_users update:', payload.eventType, payload.new || payload.old);
          
          // Reload session data when users change
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
        async (payload) => {
          console.log('📡 Real-time meetup_suggestions update:', payload.eventType, payload.new || payload.old);
          
          // Reload suggestions when they change
          await loadMeetupSuggestions(sessionId);
        }
      )
      .on('subscribe', (status) => {
        console.log('📡 Real-time subscription status:', status);
      })
      .on('error', (error) => {
        console.error('❌ Real-time subscription error:', error);
      })
      .subscribe((status) => {
        console.log('📡 Real-time channel subscribe result:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Real-time subscription active');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Real-time subscription failed');
        }
      });
  };

  // Load session data from Supabase
  const loadSessionData = async (sessionId: string) => {
    try {
      console.log('📥 Loading session data for:', sessionId);
      
      // Load session
      const { data: sessionData, error: sessionError } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('is_active', true)
        .single();

      if (sessionError) {
        console.error('❌ Session load error:', sessionError);
        throw sessionError;
      }

      // Load session users
      const { data: usersData, error: usersError } = await supabase
        .from('session_users')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at');

      if (usersError) {
        console.error('❌ Users load error:', usersError);
        throw usersError;
      }

      // Load meetup suggestions
      const { data: suggestionsData, error: suggestionsError } = await supabase
        .from('meetup_suggestions')
        .select('*')
        .eq('session_id', sessionId)
        .order('distance', { ascending: true }); // Order by distance to center

      if (suggestionsError) {
        console.error('❌ Suggestions load error:', suggestionsError);
        throw suggestionsError;
      }

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
        averageDistance: suggestion.average_distance,
        photoUrl: suggestion.photo_url || undefined,
        placeId: suggestion.place_id || undefined,
        priceLevel: suggestion.price_level || undefined,
        openNow: suggestion.open_now || undefined
      }));

      // Update session state
      currentSession.value = {
        id: sessionData.id,
        createdAt: new Date(sessionData.created_at),
        users,
        meetupSuggestions: suggestions
      };

      // NEW: Update infinite scroll state
      allGeneratedSuggestions.value = suggestions;
      if (suggestions.length > 0) {
        displayedSuggestionsCount.value = Math.min(7, suggestions.length);
      }

      // Update tracking variables
      if (suggestions.length > 0) {
        lastSuggestionHash.value = getUserConfigHash();
        console.log('📝 Updated suggestion hash after load');
      }
      lastUserCount.value = users.length;

      console.log('✅ Session data loaded successfully:', {
        users: users.length,
        connected: users.filter(u => u.connected).length,
        suggestions: suggestions.length
      });

    } catch (err) {
      console.error('❌ Error loading session data:', err);
      error.value = 'Failed to load session data';
    }
  };

  // Load meetup suggestions
  const loadMeetupSuggestions = async (sessionId: string) => {
    try {
      console.log('📥 Loading meetup suggestions for:', sessionId);
      
      const { data, error: suggestionsError } = await supabase
        .from('meetup_suggestions')
        .select('*')
        .eq('session_id', sessionId)
        .order('distance', { ascending: true }); // Order by distance to center

      if (suggestionsError) {
        console.error('❌ Suggestions load error:', suggestionsError);
        throw suggestionsError;
      }

      const suggestions: MeetupSuggestion[] = data.map(suggestion => ({
        id: suggestion.id,
        name: suggestion.name,
        type: suggestion.type,
        location: {
          lat: suggestion.location.lat,
          lng: suggestion.location.lng,
          address: suggestion.location.address
        },
        rating: suggestion.rating,
        distance: suggestion.distance,
        averageDistance: suggestion.average_distance,
        photoUrl: suggestion.photo_url || undefined,
        placeId: suggestion.place_id || undefined,
        priceLevel: suggestion.price_level || undefined,
        openNow: suggestion.open_now || undefined
      }));

      if (currentSession.value) {
        currentSession.value.meetupSuggestions = suggestions;
        
        // NEW: Update infinite scroll state
        allGeneratedSuggestions.value = suggestions;
        if (suggestions.length > 0) {
          displayedSuggestionsCount.value = Math.min(7, suggestions.length);
        }
        
        // Update hash if we have suggestions
        if (suggestions.length > 0) {
          lastSuggestionHash.value = getUserConfigHash();
          lastUserCount.value = currentSession.value.users.length;
        }
        
        console.log('✅ Suggestions loaded:', suggestions.length);
      }
    } catch (err) {
      console.error('❌ Error loading meetup suggestions:', err);
    }
  };

  // Actions
  const createSession = async () => {
    try {
      isLoading.value = true;
      console.log('🆕 Creating new session...');
      
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

      console.log('✅ Session created successfully:', sessionData.id);

    } catch (err) {
      console.error('❌ Error creating session:', err);
      error.value = 'Failed to create session';
    } finally {
      isLoading.value = false;
    }
  };

  const joinSession = async (sessionId: string) => {
    try {
      isLoading.value = true;
      console.log('🤝 Joining session:', sessionId);

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

      // Clear existing suggestions when new user joins
      console.log('🆕 New user joined, clearing existing suggestions');
      await clearMeetupSuggestions(sessionId);
      lastSuggestionHash.value = '';
      lastUserCount.value = currentSession.value?.users.length || 0;

      console.log('✅ Joined session successfully');

    } catch (err) {
      console.error('❌ Error joining session:', err);
      error.value = 'Failed to join session';
    } finally {
      isLoading.value = false;
    }
  };

  const updateUserLocation = async (location: { lat: number; lng: number; address: string }) => {
    if (!currentUserDbId.value || !currentSession.value) return;

    try {
      console.log('📍 Updating user location:', location.address);
      
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

      // Update local state immediately for better UX
      if (currentUser.value) {
        currentUser.value.location = location;
      }

      // Clear existing suggestions when user location changes
      console.log('📍 User location updated, clearing existing suggestions');
      await clearMeetupSuggestions(currentSession.value.id);
      lastSuggestionHash.value = '';

      await checkUserConnection();
      
      console.log('✅ Location updated successfully');
    } catch (err) {
      console.error('❌ Error updating user location:', err);
      error.value = 'Failed to update location';
    }
  };

  const updateUserActivity = async (activity: string) => {
    if (!currentUserDbId.value || !currentSession.value) return;

    try {
      console.log('🎯 Updating user activity:', activity);
      
      const { error: updateError } = await supabase
        .from('session_users')
        .update({
          activity: activity,
          updated_at: new Date().toISOString()
        })
        .eq('id', currentUserDbId.value);

      if (updateError) throw updateError;

      // Update local state immediately for better UX
      if (currentUser.value) {
        currentUser.value.activity = activity;
      }

      // Clear existing suggestions when user activity changes
      console.log('🎯 User activity updated, clearing existing suggestions');
      await clearMeetupSuggestions(currentSession.value.id);
      lastSuggestionHash.value = '';

      await checkUserConnection();
      
      console.log('✅ Activity updated successfully');
    } catch (err) {
      console.error('❌ Error updating user activity:', err);
      error.value = 'Failed to update activity';
    }
  };

  const checkUserConnection = async () => {
    if (!currentUser.value || !currentUserDbId.value) return;

    const isConnected = !!(currentUser.value.location && currentUser.value.activity);
    
    if (isConnected !== currentUser.value.connected) {
      try {
        console.log('🔗 Updating connection status to:', isConnected);
        
        const { error: updateError } = await supabase
          .from('session_users')
          .update({
            connected: isConnected,
            updated_at: new Date().toISOString()
          })
          .eq('id', currentUserDbId.value);

        if (updateError) throw updateError;

        // Update local state immediately
        currentUser.value.connected = isConnected;
        
        console.log('✅ Connection status updated');
      } catch (err) {
        console.error('❌ Error updating connection status:', err);
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
      console.log('🎯 Starting meetup suggestion generation...');
      console.log('Connected users:', connectedUsers.value.length);
      console.log('User details:', connectedUsers.value.map(u => ({
        name: u.name,
        location: u.location,
        activity: u.activity
      })));
      
      // Clear existing suggestions first
      console.log('🧹 Clearing existing suggestions...');
      await clearMeetupSuggestions(currentSession.value.id);
      
      // Wait a moment for database operation
      await new Promise(resolve => setTimeout(resolve, 500));

      console.log('🎯 Calculating optimal meetup locations...');
      
      // Generate initial batch of suggestions
      const calculatedSuggestions = await generateMeetupSuggestions(currentSession.value.users, 25); // Generate 25 suggestions initially
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
        distance: suggestion.distance,
        average_distance: suggestion.averageDistance,
        photo_url: suggestion.photoUrl || null,
        place_id: suggestion.placeId || null,
        price_level: suggestion.priceLevel || null,
        open_now: suggestion.openNow || null
      }));

      console.log('💾 Saving', suggestionsToInsert.length, 'suggestions to database...');
      const { error: insertError, data: insertedData } = await supabase
        .from('meetup_suggestions')
        .insert(suggestionsToInsert)
        .select();

      if (insertError) {
        console.error('❌ Error inserting suggestions:', insertError);
        throw insertError;
      }

      console.log(`✅ Successfully saved ${insertedData?.length || suggestionsToInsert.length} suggestions`);
      
      // Update tracking variables
      lastSuggestionHash.value = getUserConfigHash();
      lastUserCount.value = currentSession.value.users.length;
      currentBatch.value = 1; // Reset batch counter
      hasGeneratedAllSuggestions.value = calculatedSuggestions.length < 25; // If we got less than requested, we've hit the limit

      // Reload suggestions - this will trigger real-time updates for other users
      await loadMeetupSuggestions(currentSession.value.id);

    } catch (err) {
      console.error('❌ Error generating meetup suggestions:', err);
      error.value = 'Failed to generate meetup suggestions';
    } finally {
      isLoading.value = false;
      isGeneratingSuggestions.value = false;
    }
  };

  // NEW: Infinite scroll method to load more suggestions
  const loadMoreSuggestions = async () => {
    if (!hasMoreSuggestions.value || isLoadingMore.value || !currentSession.value) return;

    isLoadingMore.value = true;
    
    try {
      console.log('📄 Loading more suggestions...');
      
      // First, check if we have more already generated suggestions to display
      if (allGeneratedSuggestions.value.length > displayedSuggestionsCount.value) {
        // Just increase the displayed count
        const newCount = Math.min(
          displayedSuggestionsCount.value + 7,
          allGeneratedSuggestions.value.length
        );
        displayedSuggestionsCount.value = newCount;
        
        console.log(`✅ Now showing ${displayedSuggestionsCount.value} of ${allGeneratedSuggestions.value.length} suggestions`);
        
        // Small delay for better UX
        await new Promise(resolve => setTimeout(resolve, 300));
        return;
      }
      
      // If we've displayed all generated suggestions but haven't hit the limit, generate more
      if (!hasGeneratedAllSuggestions.value && canGenerateMeetups.value) {
        console.log('🎯 Generating more suggestions (batch', currentBatch.value + 1, ')...');
        
        // Generate next batch of suggestions
        const moreSuggestions = await generateMeetupSuggestions(
          currentSession.value.users, 
          15 // Generate 15 more suggestions per batch
        );
        
        if (moreSuggestions.length > 0) {
          // Filter out duplicates based on place ID or name+location
          const existingIds = new Set(allGeneratedSuggestions.value.map(s => 
            s.placeId || `${s.name}-${s.location.lat}-${s.location.lng}`
          ));
          
          const newSuggestions = moreSuggestions.filter(s => {
            const id = s.placeId || `${s.name}-${s.location.lat}-${s.location.lng}`;
            return !existingIds.has(id);
          });
          
          if (newSuggestions.length > 0) {
            // Prepare data for database insertion
            const suggestionsToInsert = newSuggestions.map(suggestion => ({
              session_id: currentSession.value!.id,
              name: suggestion.name,
              type: suggestion.type,
              location_lat: suggestion.location.lat,
              location_lng: suggestion.location.lng,
              location_address: suggestion.location.address,
              rating: suggestion.rating,
              distance: suggestion.distance,
              average_distance: suggestion.averageDistance,
              photo_url: suggestion.photoUrl || null,
              place_id: suggestion.placeId || null,
              price_level: suggestion.priceLevel || null,
              open_now: suggestion.openNow || null
            }));

            console.log('💾 Saving', suggestionsToInsert.length, 'new suggestions to database...');
            const { error: insertError } = await supabase
              .from('meetup_suggestions')
              .insert(suggestionsToInsert);

            if (insertError) {
              console.error('❌ Error inserting new suggestions:', insertError);
            } else {
              // Update local state
              allGeneratedSuggestions.value.push(...newSuggestions);
              displayedSuggestionsCount.value = Math.min(
                displayedSuggestionsCount.value + 7,
                allGeneratedSuggestions.value.length
              );
              
              currentBatch.value++;
              console.log(`✅ Added ${newSuggestions.length} new suggestions (batch ${currentBatch.value})`);
            }
          } else {
            console.log('⚠️ No new unique suggestions found');
            hasGeneratedAllSuggestions.value = true;
          }
        } else {
          console.log('⚠️ No more suggestions available');
          hasGeneratedAllSuggestions.value = true;
        }
        
        // Check if we got fewer suggestions than requested (hit the limit)
        if (moreSuggestions.length < 15) {
          hasGeneratedAllSuggestions.value = true;
        }
      }
      
    } catch (err) {
      console.error('❌ Error loading more suggestions:', err);
    } finally {
      isLoadingMore.value = false;
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
    console.log('🧹 Cleaning up store...');
    if (realtimeChannel.value) {
      realtimeChannel.value.unsubscribe();
      realtimeChannel.value = null;
    }
  };

  // Expose loadSessionData for debug panel
  const loadSessionDataPublic = loadSessionData;

  return {
    // State
    currentSession,
    currentUserId,
    isLoading,
    error,
    isLoadingMore, // NEW
    
    // Computed
    connectedUsers,
    currentUser,
    canGenerateMeetups,
    shouldShowShareLink,
    areSuggestionsOutdated,
    displayedSuggestions, // NEW: Use this instead of currentSession.meetupSuggestions
    hasMoreSuggestions, // NEW
    
    // Actions
    createSession,
    joinSession,
    updateUserLocation,
    updateUserActivity,
    generateMeetupSuggestions: generateMeetupSuggestionsAction,
    loadMoreSuggestions, // NEW
    getShareableLink,
    cleanup,
    
    // Debug methods
    loadSessionData: loadSessionDataPublic
  };
});