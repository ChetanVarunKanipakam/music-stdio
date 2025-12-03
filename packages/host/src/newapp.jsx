import React, { Suspense, useState, useEffect } from 'react';
import { audioEngine } from './audioEngine';
import { on, useStore, emit } from '@music-studio/shared';

const TrackEditor = React.lazy(() => import('trackEditor/App'));
const InstrumentsLibrary = React.lazy(() => import('instruments/Library'));
const CollabBridge = React.lazy(() => import('collaboration/Bridge'));
const generateUser = () => {
  const colors = ['#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#3498db', '#9b59b6'];
  const names = ['Producer', 'Beatmaker', 'Maestro', 'DJ', 'Composer'];
  return {
    id: 'user-' + Math.floor(Math.random() * 10000),
    name: names[Math.floor(Math.random() * names.length)] + ' ' + Math.floor(Math.random() * 100),
    color: colors[Math.floor(Math.random() * colors.length)]
  };
};
const App = () => {
  const [activePluginData, setActivePluginData] = useState(null);
  const [statusMsg, setStatusMsg] = useState('');
  const [currentUser] = useState(generateUser());
  // Actions
  const { 
    tracks, tempo, totalSteps, // Data to save
    loadProject, 
    addEffectToTrack, addNote, deleteNote, modifyNote, setIsPlaying, updateEffectParam 
  } = useStore();

  // --- SAVE LOGIC ---
  const handleSave = async () => {
    setStatusMsg('Saving...');
    const projectData = { tracks, tempo, totalSteps };
    
    try {
      await fetch('http://localhost:3004/api/project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectData)
      });
      setStatusMsg('✅ Saved!');
      setTimeout(() => setStatusMsg(''), 2000);
    } catch (e) {
      console.error(e);
      setStatusMsg('❌ Error Saving');
    }
  };

  // --- LOAD LOGIC (Rehydration) ---
  const handleLoad = async () => {
    setStatusMsg('Loading...');
    try {
      const res = await fetch('http://localhost:3004/api/project');
      if (!res.ok) throw new Error('No project');
      const data = await res.json();

      // 1. Reset Engine
      audioEngine.reset();

      // 2. Update Store
      loadProject(data);

      // 3. Rebuild Audio Graph (The Hard Part)
      // We must iterate over the loaded tracks and restore effects
      console.log("🏗 Rebuilding Audio Graph...");
      
      for (const track of data.tracks) {
        // Init Channel
        audioEngine.getTrackChannel(track.id);

        // Restore Effects
        if (track.effects && track.effects.length > 0) {
          for (const effect of track.effects) {
            console.log(`🔌 Restoring ${effect.type} for Track ${track.id}`);
            
            // Dynamic Import based on type
            let module, factory;
            if (effect.type === 'Delay') {
              module = await import('plugins/Delay');
              factory = module.createDelayNode;
            } else if (effect.type === 'Reverb') {
              module = await import('plugins/Reverb');
              factory = module.createReverbNode;
            }

            // Apply to Engine
            if (factory) {
               audioEngine.applyEffectToTrack(track.id, effect.id, factory);
               
               // Restore Parameter (Wet/Volume)
               // We need a slight delay or direct call to ensure node is ready
               audioEngine.updateEffectParam({ 
                 trackId: track.id, 
                 effectId: effect.id, 
                 param: 'wet', 
                 value: effect.params.wet 
               });
            }
          }
        }
      }
      setStatusMsg('✅ Project Loaded!');
      setTimeout(() => setStatusMsg(''), 2000);

    } catch (e) {
      console.error(e);
      setStatusMsg('❌ Error Loading');
    }
  };

  // --- EVENT LISTENERS (Keep your existing Phase 6 logic here) ---
  useEffect(() => {
    const sub = on(async (event) => {
        // ... (Keep your existing event handling logic from Phase 6) ...
        // ... (PLAY_TOGGLED, NOTE_CHANGED, ADD_EFFECT, etc.) ...
        
        // COPY PASTE THE LOGIC FROM PREVIOUS STEP HERE
        // I am omitting it for brevity, but DO NOT DELETE IT.
        if (event.type === 'ADD_EFFECT') {
             // ... existing add effect logic ...
             const { trackId, type } = event.payload;
             // ... imports ...
             // ... audioEngine.apply ...
             // ... setActivePluginData ...
             // (Ensure you use the imports inside the event handler)
             let module, factory;
             if (type === 'Delay') { module = await import('plugins/Delay'); factory = module.createDelayNode; }
             else if (type === 'Reverb') { module = await import('plugins/Reverb'); factory = module.createReverbNode; }
             
             addEffectToTrack(trackId, type);
             // ... rest of logic
             const updatedTracks = useStore.getState().tracks;
             const track = updatedTracks.find(t => t.id === trackId);
             const newEffect = track.effects[track.effects.length - 1];
             audioEngine.applyEffectToTrack(trackId, newEffect.id, factory);
             
             if(!event.isRemote) {
                 setActivePluginData({ Component: module.default, trackId, effectId: newEffect.id, initialWet: newEffect.params.wet });
             }
        }
        
        // ... other events
        if (event.type === 'PLAY_TOGGLED') setIsPlaying(event.payload);
        if (event.isRemote && event.type === 'NOTE_ADDED') addNote(event.payload.trackId, event.payload.noteObj);
        if (event.isRemote && event.type === 'NOTE_DELETED') deleteNote(event.payload.trackId, event.payload.step);
        if (event.isRemote && event.type === 'NOTE_MODIFIED') modifyNote(event.payload.trackId, event.payload.oldStep, event.payload.newStep, event.payload.newDuration);
        if (event.isRemote && event.type === 'PARAM_CHANGE') updateEffectParam(event.payload.trackId, event.payload.effectId, event.payload.param, event.payload.value);

        if (event.isRemote && event.type === 'TRACK_VOL_CHANGED') {
         // Update Store
         useStore.getState().setTrackVolume(event.payload.trackId, event.payload.volume);
         // Update Audio
         audioEngine.updateTrackVolume(event.payload.trackId);
      }

      if (event.isRemote && event.type === 'TRACK_MUTE_SOLO_CHANGED') {
         const { trackId, type } = event.payload; // type = 'mute' or 'solo'
         if(type === 'mute') useStore.getState().toggleTrackMute(trackId);
         if(type === 'solo') useStore.getState().toggleTrackSolo(trackId);
         
         audioEngine.updateMuteSoloState();
      }

      if (event.isRemote && event.type === 'TRACK_DELETED') {
         useStore.getState().deleteTrack(event.payload.trackId);
         audioEngine.removeTrack(event.payload.trackId);
      }
    });
    return () => sub.unsubscribe();
  }, []);

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#1e272e', fontFamily: 'sans-serif' }}>
      <Suspense fallback={null}> <CollabBridge /> </Suspense>
      <Suspense fallback={<div>Loading Lib...</div>}> <InstrumentsLibrary /> </Suspense>

      <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' }}>
        
        {/* Update Header to show Who I Am */}
        <div style={{ padding: '15px 20px', background: '#2d3436', color: 'white', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid #000' }}>
          <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
             <h1 style={{margin:0, fontSize:'18px'}}>🎵 Host Shell</h1>
             <span style={{fontSize:'12px', background: currentUser.color, padding:'2px 6px', borderRadius:'4px', color:'black'}}>
               You are: {currentUser.name}
             </span>
          </div>
          <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
            <span style={{color: '#ffeaa7'}}>{statusMsg}</span>
            <button onClick={handleSave} style={headerBtnStyle}>💾 Save Project</button>
            <button onClick={handleLoad} style={headerBtnStyle}>📂 Load Project</button>
          </div>
        </div>
        
        <div style={{flex: 1}}>
           <Suspense fallback={<div>Loading DAW...</div>}> 
             {/* Pass currentUser to TrackEditor */}
             <TrackEditor currentUser={currentUser} /> 
           </Suspense>
        </div>

        {activePluginData && (
          <Suspense fallback={<div>Loading UI...</div>}>
            <activePluginData.Component 
              trackId={activePluginData.trackId}
              effectId={activePluginData.effectId}
              initialWet={activePluginData.initialWet}
              onClose={() => setActivePluginData(null)} 
            />
          </Suspense>
        )}
      </div>
    </div>
  );
};

const headerBtnStyle = {
  background: '#636e72', color:'white', border:'none', padding:'8px 15px', borderRadius:'4px', cursor:'pointer'
};

export default App;