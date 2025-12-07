import React from 'react';
import { emit, useStore } from '@music-studio/shared';
import Timeline from './Timeline';

const TrackEditor = ({ currentUser }) => {
  const { isPlaying, setIsPlaying,addTrack } = useStore();

  const handleDragOver = (e) => {
    e.preventDefault(); // Necessary to allow dropping
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const data = e.dataTransfer.getData('application/json');
    if (data) {
      const inst = JSON.parse(data);
      
      console.log("Dropped Instrument:", inst); // Debug: Check if sampleUrl exists here

      // ❌ OLD CODE:
      // addTrack({ name: inst.name, type: inst.type });

      // ✅ NEW CODE: Pass the WHOLE object so sampleUrl and rootNote are included
      addTrack(inst); 
    }
  };
  const handlePlay = () => {
    setIsPlaying(!isPlaying)
    emit('PLAY_TOGGLED', !isPlaying);
  };
  const handleAddReverb = () => {
    emit('ADD_EFFECT', { type: 'Reverb' });
  };
  return (
    <div 
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={{ 
        padding: '20px', 
        background: '#1e272e', 
        color: 'white',
        height: '100vh',
        boxSizing: 'border-box'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
      <h2 style={{ margin: 0 }}>🎹 Pro Studio DAW</h2>
        <div>
           {/* NEW BUTTON */}
           <button onClick={handleAddReverb} style={{ marginRight:'10px', background:'#0984e3', color:'white', border:'none', padding:'10px' }}>
             + Add Reverb
           </button>
          <button 
            onClick={handlePlay} 
            style={{ 
              padding: '10px 30px', 
              fontSize: '18px', 
              background: isPlaying ? '#ff4757' : '#2ed573',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            {isPlaying ? '⏹ STOP' : '▶ PLAY'}
          </button>
          <button onClick={addTrack} style={{ marginLeft: '10px', padding: '10px' }}>
            + Add Track
          </button>
        </div>
      </div>
       <Timeline currentUser={currentUser} />
      <p style={{ marginTop: '10px', color: '#aaa', fontSize: '14px' }}>
        * Visuals rendered via HTML5 Canvas in "Track Editor MFE"
      </p>
    </div>
  );
};

export default TrackEditor;