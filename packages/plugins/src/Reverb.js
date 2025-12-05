import React, { useState } from 'react';
import { emit } from '@music-studio/shared';

// --- AUDIO LOGIC (True Convolution Reverb) ---
export const createReverbNode = (audioContext) => {
  const input = audioContext.createGain();
  const output = audioContext.createGain();
  const convolver = audioContext.createConvolver();
  const wetGain = audioContext.createGain();

  // Generate Impulse Response (Simulates a large hall)
  const duration = 2.0;
  const decay = 2.0;
  const rate = audioContext.sampleRate;
  const length = rate * duration;
  const impulse = audioContext.createBuffer(2, length, rate);
  const L = impulse.getChannelData(0);
  const R = impulse.getChannelData(1);

  for (let i = 0; i < length; i++) {
    const n = length - i;
    // Exponential decay noise
    const v = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    L[i] = v;
    R[i] = v;
  }
  convolver.buffer = impulse;

  // Routing
  input.connect(output); // Dry signal
  input.connect(convolver);
  convolver.connect(wetGain);
  wetGain.connect(output);
  
  wetGain.gain.value = 1.5; // Boost it because convolution is quiet

  return { input, output, wetGain };
};

// --- UI LOGIC ---
const ReverbUI = ({ onClose, trackId, effectId, initialWet }) => {
  const [val, setVal] = useState(typeof initialWet === 'number' ? initialWet : 1.5);

  const handleChange = (e) => {
    const newVal = parseFloat(e.target.value);
    setVal(newVal);
    emit('PARAM_CHANGE', { trackId, effectId, effectType: 'Reverb', param: 'wet', value: newVal });
  };

  return (
    <div style={{
      position: 'fixed', top: '150px', right: '20px',
      width: '220px', background: '#2c3e50', color: '#fff',
      padding: '15px', border: '2px solid #a29bfe', // Purple border
      borderRadius: '8px', zIndex: 9999,
      boxShadow: '0 4px 15px rgba(0,0,0,0.5)'
    }}>
      <div style={{display:'flex', justifyContent:'space-between', marginBottom:'15px'}}>
        <strong>🏰 Hall Reverb (ID: {Math.floor(effectId)})</strong>
        <button onClick={onClose} style={{cursor:'pointer', background:'none', border:'none', color:'white'}}>✕</button>
      </div>
      <div>
        <label style={{fontSize: '12px'}}>Mix Level</label>
        <input type="range" min="0" max="3.0" step="0.1" value={val} onChange={handleChange} style={{width:'100%'}} />
      </div>
    </div>
  );
};

export default ReverbUI;