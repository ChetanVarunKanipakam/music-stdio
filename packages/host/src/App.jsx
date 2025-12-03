import React, { Suspense, useState, useEffect } from 'react';
import { audioEngine } from './audioEngine';
import { on, useStore, emit } from '@music-studio/shared';

const TrackEditor = React.lazy(() => import('trackEditor/App'));
const InstrumentsLibrary = React.lazy(() => import('instruments/Library'));
const CollabBridge = React.lazy(() => import('collaboration/Bridge'));

const App = () => {
  const [activePluginData, setActivePluginData] = useState(null);
  const [projectList, setProjectList] = useState([]); // List of DB projects
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  
  const { 
    tracks, tempo, totalSteps, 
    loadProject, addTrack, removeEffectFromTrack,
    addEffectToTrack, addNote, deleteNote, modifyNote, setIsPlaying, updateEffectParam 
  } = useStore();

  // --- AUDIO IMPORT LOGIC ---
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setStatusMsg('Uploading...');
    const formData = new FormData();
    formData.append('audioFile', file);

    try {
      const res = await fetch('http://localhost:3004/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      
      // Add as a new Track
      addTrack({
        name: data.filename.substring(0, 15), // Shorten name
        type: 'sampler',
        sampleUrl: data.url, // URL from server
        rootNote: 'C4'
      });
      setStatusMsg('✅ Imported!');
    } catch (err) {
      console.error(err);
      setStatusMsg('❌ Upload Failed');
    }
  };

  // --- SAVE / LOAD LOGIC ---
  const handleSave = async () => {
    const projectName = prompt("Project Name:", "My Awesome Song");
    if(!projectName) return;
    
    setStatusMsg('Saving...');
    try {
      await fetch('http://localhost:3004/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: projectName, tracks, tempo, totalSteps })
      });
      setStatusMsg('✅ Saved to DB!');
    } catch (e) { setStatusMsg('❌ Error'); }
  };

  const fetchProjects = async () => {
    const res = await fetch('http://localhost:3004/api/projects');
    const data = await res.json();
    setProjectList(data);
    setShowProjectModal(true);
  };

  const loadSpecificProject = async (id) => {
    const res = await fetch(`http://localhost:3004/api/projects/${id}`);
    const data = await res.json();
    
    audioEngine.reset();
    loadProject(data);
    
    // Rehydration Logic (Same as before)
    setTimeout(async () => {
       for (const track of data.tracks) {
         audioEngine.getTrackChannel(track.id);
         if (track.effects) {
           for (const effect of track.effects) {
             let module, factory;
             if (effect.type === 'Delay') { module = await import('plugins/Delay'); factory = module.createDelayNode; }
             else if (effect.type === 'Reverb') { module = await import('plugins/Reverb'); factory = module.createReverbNode; }
             if (factory) audioEngine.applyEffectToTrack(track.id, effect.id, factory);
           }
         }
       }
    }, 100);
    
    setShowProjectModal(false);
  };

  // --- EVENT LISTENERS ---
  useEffect(() => {
    const sub = on(async (event) => {
      // ... keep existing handlers ...
      if (event.type === 'PLAY_TOGGLED') setIsPlaying(event.payload);
      if (event.isRemote && event.type === 'NOTE_ADDED') addNote(event.payload.trackId, event.payload.noteObj);
      if (event.isRemote && event.type === 'NOTE_DELETED') deleteNote(event.payload.trackId, event.payload.step);
      if (event.isRemote && event.type === 'NOTE_MODIFIED') modifyNote(event.payload.trackId, event.payload.oldStep, event.payload.newStep, event.payload.newDuration);
      if (event.isRemote && event.type === 'PARAM_CHANGE') updateEffectParam(event.payload.trackId, event.payload.effectId, event.payload.param, event.payload.value);
      
      // 🔥 NEW: REMOVE EFFECT
      if (event.type === 'REMOVE_EFFECT') {
        const { trackId, effectId } = event.payload;
        // 1. Update Store
        removeEffectFromTrack(trackId, effectId);
        // 2. Audio Engine listens separately and rebuilds
        
        // Close UI if it was open
        if (activePluginData && activePluginData.effectId === effectId) {
          setActivePluginData(null);
        }
      }

      // ... keep ADD_EFFECT logic ...
       if (event.type === 'ADD_EFFECT') {
             const { trackId, type } = event.payload;
             let module, factory;
             if (type === 'Delay') { module = await import('plugins/Delay'); factory = module.createDelayNode; }
             else if (type === 'Reverb') { module = await import('plugins/Reverb'); factory = module.createReverbNode; }
             
             addEffectToTrack(trackId, type);
             // Wait for store update...
             const updatedTracks = useStore.getState().tracks;
             const track = updatedTracks.find(t => t.id === trackId);
             const newEffect = track.effects[track.effects.length - 1];
             audioEngine.applyEffectToTrack(trackId, newEffect.id, factory);
             
             if(!event.isRemote) {
                 setActivePluginData({ Component: module.default, trackId, effectId: newEffect.id, initialWet: newEffect.params.wet });
             }
        }
    });
    return () => sub.unsubscribe();
  }, [activePluginData]); // Add dependency

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#1e272e', fontFamily: 'sans-serif' }}>
      <Suspense fallback={null}> <CollabBridge /> </Suspense>
      <Suspense fallback={<div>Loading...</div>}> <InstrumentsLibrary /> </Suspense>

      <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' }}>
        
        {/* HEADER */}
        <div style={{ padding: '10px', background: '#2d3436', color: 'white', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid #000' }}>
          <h1>🎵 Studio</h1>
          <div style={{display:'flex', gap:'10px'}}>
             <span>{statusMsg}</span>
             
             {/* Import Button */}
             <label style={btnStyle}>
                🎤 Import Audio
                <input type="file" accept="audio/*" style={{display:'none'}} onChange={handleFileUpload} />
             </label>

             <button onClick={handleSave} style={btnStyle}>💾 Save</button>
             <button onClick={fetchProjects} style={btnStyle}>📂 Open</button>
          </div>
        </div>
        
        <div style={{flex: 1}}>
           <Suspense fallback={<div>Loading DAW...</div>}> <TrackEditor /> </Suspense>
        </div>

        {/* PLUGIN WINDOW */}
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

        {/* PROJECT LIST MODAL */}
        {showProjectModal && (
          <div style={{
            position:'fixed', top:0, left:0, width:'100%', height:'100%', 
            background:'rgba(0,0,0,0.8)', display:'flex', justifyContent:'center', alignItems:'center', zIndex:10000
          }}>
            <div style={{background:'white', padding:'20px', borderRadius:'5px', width:'300px'}}>
              <h3>Open Project</h3>
              <ul style={{listStyle:'none', padding:0}}>
                {projectList.map(p => (
                  <li key={p._id} style={{marginBottom:'10px', display:'flex', justifyContent:'space-between'}}>
                    <span>{p.name}</span>
                    <button onClick={() => loadSpecificProject(p._id)}>Load</button>
                  </li>
                ))}
              </ul>
              <button onClick={() => setShowProjectModal(false)} style={{marginTop:'10px'}}>Close</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const btnStyle = {
  background: '#636e72', color:'white', border:'none', padding:'5px 10px', borderRadius:'4px', cursor:'pointer', fontSize:'12px'
};

export default App;