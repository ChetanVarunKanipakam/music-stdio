import React from 'react';

const instruments = [
  { 
    id: 'inst-1', 
    name: 'Retro Synth', 
    type: 'synth', 
    color: '#e74c3c' 
  },
  { 
    id: 'inst-2', 
    name: 'Deep Bass', 
    type: 'synth', 
    color: '#8e44ad' 
  },
  // 🔥 NEW: Sampler Instrument
  { 
    id: 'inst-3', 
    name: 'Grand Piano', 
    type: 'sampler', 
    color: '#f1c40f',
    // We use a public C4 piano sample for testing
    sampleUrl: 'https://tonejs.github.io/audio/salamander/C4.mp3',
    rootNote: 'C4'
  },
];

const Library = () => {
  const handleDragStart = (e, inst) => {
    e.dataTransfer.setData('application/json', JSON.stringify(inst));
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div style={{ 
      width: '200px', background: '#2f3640', borderRight: '1px solid #111', 
      height: '100%', padding: '10px', color: 'white', overflowY: 'auto'
    }}>
      <h3>🎸 Library</h3>
      <p style={{fontSize: '12px', color: '#aaa'}}>Drag to Timeline</p>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {instruments.map(inst => (
          <div
            key={inst.id}
            draggable
            onDragStart={(e) => handleDragStart(e, inst)}
            style={{
              padding: '15px', background: inst.color, borderRadius: '5px',
              cursor: 'grab', fontWeight: 'bold', boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
              color: '#000'
            }}
          >
            {inst.name}
            <div style={{fontSize: '10px', opacity: 0.7}}>
               {inst.type === 'sampler' ? 'Real Audio' : 'Synthesizer'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Library;