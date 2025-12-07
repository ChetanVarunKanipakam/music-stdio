import React, { useRef, useEffect, useState } from 'react';
import { useStore, on, emit } from '@music-studio/shared';

const CELL_WIDTH = 40;
const TRACK_HEIGHT = 100;
const HEADER_HEIGHT = 30;

// Full Note Range
const NOTES = [
  'C2','C#2','D2','D#2','E2','F2','F#2','G2','G#2','A2','A#2','B2',
  'C3','C#3','D3','D#3','E3','F3','F#3','G3','G#3','A3','A#3','B3',
  'C4','C#4','D4','D#4','E4','F4','F#4','G4','G#4','A4','A#4','B4',
  'C5','C#5','D5','D#5','E5','F5','F#5','G5','G#5','A5','A#5','B5'
];

const Timeline = ({ currentUser }) => {
  const canvasRef = useRef(null);
  
  // Store Access
  const { 
    tracks, totalSteps, tempo, 
    setTotalSteps, setTempo, 
    addNote, deleteNote, modifyNote ,
     setTrackVolume, toggleTrackMute, toggleTrackSolo, deleteTrack 
  } = useStore();

  const [currentStep, setCurrentStep] = useState(-1);
  const [selectedPitches, setSelectedPitches] = useState({});

  // Interaction State
  const [dragState, setDragState] = useState(null); 
  const [mouseCursor, setMouseCursor] = useState('default');

  const remoteCursors = useRef({});
  // --- SYNC WITH PLAYBACK ---
  useEffect(() => {
    const sub = on((event) => {
      if (event.type === 'STEP_CHANGED') setCurrentStep(event.payload);
      if (event.type === 'PLAY_TOGGLED' && !event.payload) setCurrentStep(-1);
      
      // 🔥 LISTEN FOR REMOTE CURSORS
      if (event.isRemote && event.type === 'CURSOR_MOVE') {
        const { userId, x, y, name, color } = event.payload;
        
        // Update the ref
        remoteCursors.current[userId] = {
          x, y, name, color, 
          lastSeen: Date.now()
        };
      }
    });
    return () => sub.unsubscribe();
  }, []);

  const lastEmitTime = useRef(0);

  const broadcastCursor = (x, y) => {
    const now = Date.now();
    // Only send every 50ms (20fps) to save bandwidth
    if (now - lastEmitTime.current > 50) {
      if (currentUser) {
         emit('CURSOR_MOVE', {
           userId: currentUser.id,
           name: currentUser.name,
           color: currentUser.color,
           x: x, // Send raw coordinates (or step/trackIndex if you prefer grid-locking)
           y: y
         });
      }
      lastEmitTime.current = now;
    }
  };
  const handleVolume = (trackId, val) => {
    const vol = parseFloat(val);
    setTrackVolume(trackId, vol);
    emit('TRACK_VOL_CHANGED', { trackId, volume: vol });
  };

  const handleMute = (trackId) => {
    toggleTrackMute(trackId);
    emit('TRACK_MUTE_SOLO_CHANGED', { trackId, type: 'mute' });
  };

  const handleSolo = (trackId) => {
    toggleTrackSolo(trackId);
    emit('TRACK_MUTE_SOLO_CHANGED', { trackId, type: 'solo' });
  };

  const handleDeleteTrack = (trackId) => {
    if(confirm('Delete this track?')) {
      deleteTrack(trackId);
      emit('TRACK_DELETED', { trackId });
    }
  };

  // --- HELPER: HIT TEST ---
  const hitTestNote = (track, x, y) => {
    for (let note of track.notes) {
      const noteX = note.step * CELL_WIDTH;
      const noteW = note.duration * CELL_WIDTH;
      
      // Check collision
      if (x >= noteX && x <= noteX + noteW) {
        // Check if near right edge (Resize area)
        if (x > noteX + noteW - 10) {
          return { type: 'EDGE', note };
        }
        return { type: 'BODY', note };
      }
    }
    return null;
  };

  // --- MOUSE HANDLERS ---

  const handleMouseDown = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (y < HEADER_HEIGHT) return;

    const trackIndex = Math.floor((y - HEADER_HEIGHT) / TRACK_HEIGHT);
    const track = tracks[trackIndex];
    if (!track) return;

    const hit = hitTestNote(track, x, y - HEADER_HEIGHT - (trackIndex * TRACK_HEIGHT));

    if (hit) {
      // CLICKED EXISTING NOTE
      if (e.button === 2) { 
        // Right Click -> Delete
        e.preventDefault();
        
        // 1. Update Local
        deleteNote(track.id, hit.note.step);
        
        // 2. 🔥 EMIT SYNC EVENT
        emit('NOTE_DELETED', { trackId: track.id, step: hit.note.step });
        
      } else {
        // Left Click -> Prepare Move or Resize
        setDragState({
          type: hit.type === 'EDGE' ? 'RESIZE' : 'MOVE',
          trackId: track.id,
          noteStep: hit.note.step, 
          initialStep: hit.note.step,
          initialDuration: hit.note.duration,
          startX: x
        });
      }
    } else {
      // CLICKED EMPTY SPACE -> DRAW NEW NOTE
      if (e.button === 0) {
        const step = Math.floor(x / CELL_WIDTH);
        if (step >= 0 && step < totalSteps) {
          const pitch = selectedPitches[track.id] || (track.name.toLowerCase().includes('bass') ? 'C3' : 'C4');
          
          const newNote = { note: pitch, step, duration: 2 };

          // 1. Update Local
          addNote(track.id, newNote);
          
          // 2. 🔥 EMIT SYNC EVENT
          emit('NOTE_ADDED', { trackId: track.id, noteObj: newNote });

          // 3. Immediately start resizing this new note for UX
          setDragState({
            type: 'RESIZE',
            trackId: track.id,
            noteStep: step,
            initialStep: step,
            initialDuration: 2,
            startX: x + (2 * CELL_WIDTH)
          });
        }
      }
    }
  };

  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // 🔥 BROADCAST MY POSITION
    broadcastCursor(x, y);
    // 1. UPDATE CURSOR (If not dragging)
    if (!dragState) {
      if (y > HEADER_HEIGHT) {
        const trackIndex = Math.floor((y - HEADER_HEIGHT) / TRACK_HEIGHT);
        const track = tracks[trackIndex];
        if (track) {
          const hit = hitTestNote(track, x, y - HEADER_HEIGHT - (trackIndex * TRACK_HEIGHT));
          if (hit) {
            setMouseCursor(hit.type === 'EDGE' ? 'ew-resize' : 'grab');
            return;
          }
        }
      }
      setMouseCursor('default');
      return;
    }

    // 2. HANDLE DRAGGING (Local Visual Update Only)
    const deltaX = x - dragState.startX;
    const stepsDelta = Math.round(deltaX / CELL_WIDTH);

    if (dragState.type === 'MOVE') {
      const newStep = Math.max(0, dragState.initialStep + stepsDelta);
      if (newStep !== dragState.initialStep) {
        modifyNote(dragState.trackId, dragState.noteStep, newStep, dragState.initialDuration);
        setDragState(prev => ({ ...prev, noteStep: newStep })); // Update ref to follow
      }
    } else if (dragState.type === 'RESIZE') {
      const newDuration = Math.max(1, dragState.initialDuration + stepsDelta);
      if (newDuration !== dragState.initialDuration) {
        modifyNote(dragState.trackId, dragState.noteStep, dragState.noteStep, newDuration);
      }
    }
    
  };

  const handleMouseUp = () => {
    // 3. 🔥 ON RELEASE: EMIT SYNC EVENT FOR MODIFICATION
    if (dragState) {
       // We need to look up the final state of the note from the store
       const track = tracks.find(t => t.id === dragState.trackId);
       const note = track.notes.find(n => n.step === dragState.noteStep);
       
       if (note) {
         emit('NOTE_MODIFIED', {
           trackId: dragState.trackId,
           oldStep: dragState.initialStep, // Need original step to identify which note to update on remote
           newStep: note.step,
           newDuration: note.duration
         });
       }
    }
    setDragState(null);
  };

  // --- CANVAS RENDERING ---
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = totalSteps * CELL_WIDTH;
    const height = tracks.length * TRACK_HEIGHT + HEADER_HEIGHT;
    
    // Resize Canvas
    canvas.width = width;
    canvas.height = height;

    // Background
    ctx.fillStyle = '#2c3e50'; ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#34495e'; ctx.fillRect(0, 0, width, HEADER_HEIGHT);
    
    // Grid
    ctx.strokeStyle = '#465a6f';
    for (let i = 0; i <= totalSteps; i++) {
        const x = i * CELL_WIDTH;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
        if (i < totalSteps) { ctx.fillStyle = '#bdc3c7'; ctx.font='10px Arial'; ctx.fillText(i + 1, x + 5, 20); }
    }

    // Tracks
    tracks.forEach((track, trackIndex) => {
      const y = HEADER_HEIGHT + (trackIndex * TRACK_HEIGHT);
      
      // Row Background
      ctx.fillStyle = trackIndex % 2 === 0 ? '#304255' : '#2c3e50';
      ctx.fillRect(0, y, width, TRACK_HEIGHT);
      ctx.strokeStyle = '#1a252f';
      ctx.beginPath(); ctx.moveTo(0, y + TRACK_HEIGHT); ctx.lineTo(width, y + TRACK_HEIGHT); ctx.stroke();

      // Notes
      track.notes.forEach(note => {
        const x = note.step * CELL_WIDTH;
        const w = (note.duration || 1) * CELL_WIDTH;
        
        const isDragging = dragState && dragState.trackId === track.id && dragState.noteStep === note.step;
        ctx.fillStyle = isDragging ? '#ff7675' : '#e74c3c'; 
        
        ctx.fillRect(x + 1, y + 10, w - 2, TRACK_HEIGHT - 20);
        
        ctx.fillStyle = 'white';
        ctx.font = '11px Arial';
        ctx.fillText(note.note, x + 5, y + 30);
        
        // Resize Handle
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillRect(x + w - 8, y + 10, 6, TRACK_HEIGHT - 20);
      });
    });

    // Playhead
    if (currentStep >= 0) {
       const x = currentStep * CELL_WIDTH;
       ctx.fillStyle = 'rgba(46, 204, 113, 0.3)'; 
       ctx.fillRect(x, 0, CELL_WIDTH, height);
       ctx.strokeStyle = '#2ecc71'; 
       ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }

    Object.values(remoteCursors.current).forEach(cursor => {
      // Cleanup old cursors (optional: if lastSeen > 10 sec ago, don't draw)
      if (Date.now() - cursor.lastSeen > 5000) return;

      const { x, y, color, name } = cursor;
      
      // Draw Cursor Line (Vertical Flag)
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 20);
      ctx.stroke();

      // Draw Name Tag
      ctx.fillStyle = color;
      ctx.fillRect(x + 2, y + 20, ctx.measureText(name).width + 6, 14);
      ctx.fillStyle = 'black';
      ctx.font = 'bold 10px Arial';
      ctx.fillText(name, x + 5, y + 31);
    });

    // Force re-render for smooth cursor animation?
    // Actually, useEffect dependency on 'tracks' handles grid, 
    // but cursors update frequently. To make cursors strictly smooth, 
    // we would need requestAnimationFrame loop. 
    // But for this project, let's rely on React state updates or 
    // just force a re-render when a cursor moves.
    
    // TRICK: To force re-render for cursor smoothing without state thrashing:
    // We accept that cursors might lag slightly until a track updates or playback step.
    // OR we add a dummy state dependency if we want 60fps cursors.
    
  }, [tracks, totalSteps, currentStep, dragState]);

  // --- UI HANDLERS ---
  const handleAddEffect = (trackId, type) => emit('ADD_EFFECT', { trackId, type });
  const handlePitchChange = (trackId, note) => setSelectedPitches(prev => ({ ...prev, [trackId]: note }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      
      {/* TOOLBAR */}
      <div style={{ 
        height: '40px', background: '#222', color: 'white', 
        display: 'flex', alignItems: 'center', padding: '0 20px', gap: '20px',
        borderBottom: '1px solid #444'
      }}>
        <div style={{display:'flex', alignItems:'center', gap: '5px'}}>
           <label style={{fontSize:'12px'}}>BPM:</label>
           <input 
             type="number" value={tempo} 
             onChange={(e) => setTempo(parseInt(e.target.value))} 
             style={{width: '50px', background:'#333', color:'white', border:'1px solid #555'}}
           />
        </div>
        <div style={{display:'flex', alignItems:'center', gap: '5px'}}>
           <label style={{fontSize:'12px'}}>Steps:</label>
           <input 
             type="number" value={totalSteps} 
             onChange={(e) => setTotalSteps(parseInt(e.target.value))} 
             style={{width: '50px', background:'#333', color:'white', border:'1px solid #555'}}
           />
        </div>
        <div style={{fontSize:'12px', color:'#aaa'}}>
           (Left: Draw/Drag/Resize | Right: Delete)
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* SIDEBAR */}
        <div style={{ width: '200px', paddingTop: HEADER_HEIGHT, background: '#1e272e', overflowY: 'auto' }}>
          {tracks.map((track, i) => (
            <div key={track.id} style={{ 
              height: TRACK_HEIGHT - 5, // Subtract padding
              padding: '5px', color: 'white',
              borderBottom: '1px solid #333', 
              background: i % 2 === 0 ? '#304255' : '#2c3e50',
              display: 'flex', flexDirection: 'column', gap: '5px'
            }}>
              {/* Row 1: Name & Delete */}
              <div style={{display:'flex', justifyContent:'space-between'}}>
                <div style={{fontWeight:'bold', fontSize:'12px'}}>{track.name}</div>
                <button onClick={() => handleDeleteTrack(track.id)} style={{background:'transparent', border:'none', cursor:'pointer'}}>🗑️</button>
              </div>
              
              {/* Row 2: Pitch */}
              <select 
                style={{width: '100%', fontSize: '10px'}}
                value={selectedPitches[track.id] || (track.name.toLowerCase().includes('bass') ? 'C3' : 'C4')}
                onChange={(e) => handlePitchChange(track.id, e.target.value)}
              >
                {NOTES.map(n => <option key={n} value={n}>{n}</option>)}
              </select>

              {/* Row 3: Mixer Controls */}
              <div style={{display:'flex', alignItems:'center', gap: '5px'}}>
                {/* Volume Slider */}
                <input 
                  type="range" min="0" max="1" step="0.05" 
                  value={track.volume !== undefined ? track.volume : 0.8}
                  onChange={(e) => handleVolume(track.id, e.target.value)}
                  style={{flex: 1, height: '5px'}}
                />
                {/* Mute/Solo */}
                <button 
                  onClick={() => handleMute(track.id)} 
                  style={{
                     fontSize:'9px', cursor:'pointer', border:'none', padding:'2px 4px', borderRadius:'2px',
                     background: track.muted ? '#ff7675' : '#555', color: 'white'
                  }}
                >M</button>
                <button 
                  onClick={() => handleSolo(track.id)} 
                  style={{
                     fontSize:'9px', cursor:'pointer', border:'none', padding:'2px 4px', borderRadius:'2px',
                     background: track.solo ? '#ffeaa7' : '#555', color: track.solo ? 'black' : 'white'
                  }}
                >S</button>
              </div>

              {/* Row 4: FX */}
              <div style={{display:'flex', gap:'5px'}}>
                <button onClick={() => emit('ADD_EFFECT', { trackId: track.id, type: 'Delay' })} style={btnStyle('#fdcb6e')}>+ Delay</button>
                <button onClick={() => emit('ADD_EFFECT', { trackId: track.id, type: 'Reverb' })} style={btnStyle('#a29bfe')}>+ Verb</button>
              </div>
              <div style={{display: 'flex', flexWrap: 'wrap', gap: '2px', marginTop:'2px'}}>
                {track.effects.map(e => (
                  <div key={e.id} style={{
                    background: '#555', fontSize: '9px', padding: '2px 4px', 
                    borderRadius: '3px', display: 'flex', alignItems: 'center', gap: '3px'
                  }}>
                    {e.type}
                    <span 
                      onClick={() => emit('REMOVE_EFFECT', { trackId: track.id, effectId: e.id })}
                      style={{cursor: 'pointer', color: '#ff7675', fontWeight: 'bold'}}
                    >
                      ×
                    </span>
                  </div>
                ))}
             </div>
            </div>
          ))}
        </div>

        {/* Canvas */}
        <div style={{ overflow: 'auto', flex: 1, background: '#2c3e50', cursor: mouseCursor }}>
          <canvas ref={canvasRef} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onContextMenu={e=>e.preventDefault()} />
        </div>
      </div>
    </div>
  );
};

const btnStyle = (color) => ({
  background: color, color: 'black', border: 'none', 
  borderRadius: '3px', fontSize: '9px', padding: '3px', cursor: 'pointer', flex: 1
});

export default Timeline;