import React, { useState } from 'react';
import { emit } from '@music-studio/shared';

// --- AUDIO LOGIC (Loud Delay / Echo) ---
// Renamed to createDelayNode for clarity
export const createDelayNode = (audioContext) => {
  console.log("🔌 Plugin: Creating Delay Node...");

  const inputNode = audioContext.createGain();
  const outputNode = audioContext.createGain();

  const delayNode = audioContext.createDelay(5.0); // max 5s
  const feedbackGain = audioContext.createGain();
  const wetGain = audioContext.createGain();

  // Configuration
  delayNode.delayTime.value = 0.3; // 300ms Echo
  feedbackGain.gain.value = 0.4;   // 40% Feedback
  wetGain.gain.value = 0.8;        // Default Mix

  // Routing
  // 1. Dry Path (Input -> Output)
  inputNode.connect(outputNode); 

  // 2. Wet Path (Input -> Delay -> WetGain -> Output)
  inputNode.connect(delayNode);
  delayNode.connect(wetGain);
  wetGain.connect(outputNode);

  // 3. Feedback Loop (Delay -> Feedback -> Delay)
  delayNode.connect(feedbackGain);
  feedbackGain.connect(delayNode);

  // Expose nodes for the Engine
  return { input: inputNode, output: outputNode, wetGain };
};

// --- UI LOGIC ---
const DelayUI = ({ onClose, trackId, effectId, initialWet }) => {
  // Initialize state with the STORED value passed from Host
  const [val, setVal] = useState(typeof initialWet === 'number' ? initialWet : 0.8);

  const handleChange = (e) => {
    const newVal = parseFloat(e.target.value);
    setVal(newVal);

    emit('PARAM_CHANGE', {
      trackId,
      effectId, // Target specific effect instance
      effectType: 'Delay', // 🔥 CRITICAL: Must match the type used in Store/Host
      param: 'wet',
      value: newVal,
    });
  };

  return (
    <div style={{
      position: 'fixed', top: '150px', right: '20px',
      width: '220px', background: '#2d3436', color: '#fff',
      padding: '15px', border: '2px solid #fdcb6e', // Orange Border for Delay
      borderRadius: '8px', zIndex: 9999,
      boxShadow: '0 4px 15px rgba(0,0,0,0.5)'
    }}>
      <div style={{display:'flex', justifyContent:'space-between', marginBottom:'15px'}}>
        {/* Updated Title */}
        <strong>📢 Delay (ID: {Math.floor(effectId)})</strong>
        <button onClick={onClose} style={{cursor:'pointer', background:'none', border:'none', color:'white'}}>✕</button>
      </div>

      <div style={{ marginBottom: '10px' }}>
        <label style={{display:'block', marginBottom: '6px', fontSize: '12px'}}>Feedback Volume</label>
        <input
          type="range" min="0" max="1.5" step="0.05"
          value={val}
          onChange={handleChange}
          style={{width: '100%', cursor: 'pointer'}}
        />
        <div style={{textAlign:'right', fontSize:'10px', color:'#aaa'}}>{val.toFixed(2)}</div>
      </div>
    </div>
  );
};

export default DelayUI;