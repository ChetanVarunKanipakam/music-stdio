import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { on, emit } from '@music-studio/shared';

// Connect to our Node Server
const socket = io('http://localhost:3004');

const Bridge = () => {
  useEffect(() => {
    console.log("🌐 Collab Bridge: Initializing...");

    // --- 1. OUTGOING: Local Bus -> WebSocket ---
    const subscription = on((event) => {
      // Prevent infinite loops!
      if (!event.isRemote) {
        
        // Whitelist events we want to sync
        const syncableEvents = [
          'PLAY_TOGGLED', 
          'PARAM_CHANGE', 
          'ADD_EFFECT',
          // 🔥 NEW: Granular Note Events
          'NOTE_ADDED',
          'NOTE_DELETED',
          'NOTE_MODIFIED',
          'CURSOR_MOVE',
          'TRACK_VOL_CHANGED',
          'TRACK_MUTE_SOLO_CHANGED',
          'TRACK_DELETED'
        ];
        
        // Note: We removed 'STEP_CHANGED' to avoid network flooding/jitter
        
        if (syncableEvents.includes(event.type)) {
           socket.emit('SYNC_EVENT', event);
        }
      }
    });

    // --- 2. INCOMING: WebSocket -> Local Bus ---
    socket.on('SYNC_EVENT', (remoteEvent) => {
      console.log("📩 Received Remote Event:", remoteEvent.type);
      
      // Inject into local system
      // Mark as isRemote=true to prevent re-broadcasting
      emit(remoteEvent.type, { ...remoteEvent.payload }, true); 
    });

    return () => {
      subscription.unsubscribe();
      socket.off('SYNC_EVENT');
    };
  }, []);

  return null;
};

export default Bridge;