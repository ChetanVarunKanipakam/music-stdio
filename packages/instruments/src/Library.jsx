import React, { useState, useMemo, useRef } from 'react';
import { Search, Music, Mic, Volume2, Grid, List } from 'lucide-react'; // You might need to install lucide-react

// 🎹 Mock Data (Expanded)
const instruments = [
  { id: 'inst-1', name: 'Retro Synth', type: 'synth', category: 'Lead', color: '#e74c3c' },
  { id: 'inst-2', name: 'Deep Bass', type: 'synth', category: 'Bass', color: '#8e44ad' },
  { 
    id: 'inst-3', 
    name: 'Grand Piano', 
    type: 'sampler', 
    category: 'Keys',
    color: '#f1c40f',
    sampleUrl: 'https://tonejs.github.io/audio/salamander/C4.mp3', // Real preview
    rootNote: 'C4'
  },
  { 
    id: 'inst-4', 
    name: '808 Kick', 
    type: 'sampler', 
    category: 'Drums',
    color: '#e67e22',
    sampleUrl: 'https://tonejs.github.io/audio/drum-samples/CR78/kick.mp3',
    rootNote: 'C2'
  },
];

const Library = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'synth', 'sampler'
  const [previewingId, setPreviewingId] = useState(null);
  
  // Audio Ref to manage playback without re-rendering
  const audioRef = useRef(new Audio());

  // 🔍 Filter Logic
  const filteredInstruments = useMemo(() => {
    return instruments.filter(inst => {
      const matchesSearch = inst.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesTab = activeTab === 'all' || inst.type === activeTab;
      return matchesSearch && matchesTab;
    });
  }, [searchTerm, activeTab]);

  // 🖱️ Drag Handling
  const handleDragStart = (e, inst) => {
    e.dataTransfer.setData('application/json', JSON.stringify(inst));
    e.dataTransfer.effectAllowed = 'copy';
    
    // Create a custom drag image (optional fancy touch)
    const dragIcon = document.createElement('div');
    dragIcon.textContent = `🎵 ${inst.name}`;
    dragIcon.style.background = inst.color;
    dragIcon.style.padding = '5px 10px';
    dragIcon.style.borderRadius = '4px';
    dragIcon.style.position = 'absolute'; 
    dragIcon.style.top = '-1000px';
    document.body.appendChild(dragIcon);
    e.dataTransfer.setDragImage(dragIcon, 0, 0);
    setTimeout(() => document.body.removeChild(dragIcon), 0);
  };

  // 🔊 Preview Logic
  const playPreview = (inst) => {
    if (inst.type === 'sampler' && inst.sampleUrl) {
      setPreviewingId(inst.id);
      audioRef.current.src = inst.sampleUrl;
      audioRef.current.volume = 0.5;
      audioRef.current.play().catch(e => console.error("Audio play failed", e));
      
      // Reset icon when audio ends
      audioRef.current.onended = () => setPreviewingId(null);
    } else {
      // Mock beep for synths (since they don't have URLs in this data structure)
      console.log(`Previewing Synth: ${inst.name}`);
    }
  };

  return (
    <div style={styles.container}>
      {/* Header Section */}
      <div style={styles.header}>
        <div style={styles.titleRow}>
          <h3>🎹 Library</h3>
          <span style={styles.countBadge}>{filteredInstruments.length}</span>
        </div>
        
        {/* Search Bar */}
        <div style={styles.searchWrapper}>
          <Search size={14} color="#aaa" />
          <input 
            type="text" 
            placeholder="Search sounds..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={styles.searchInput}
          />
        </div>

        {/* Categories / Tabs */}
        <div style={styles.tabs}>
          {['all', 'synth', 'sampler'].map(tab => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                ...styles.tab,
                ...(activeTab === tab ? styles.activeTab : {})
              }}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Instruments List */}
      <div style={styles.list}>
        {filteredInstruments.length === 0 ? (
          <div style={styles.emptyState}>No instruments found</div>
        ) : (
          filteredInstruments.map(inst => (
            <div
              key={inst.id}
              draggable
              onDragStart={(e) => handleDragStart(e, inst)}
              style={styles.card}
              className="instrument-card" // Use CSS for hover effects if possible
            >
              {/* Color Strip */}
              <div style={{...styles.colorStrip, background: inst.color}}></div>
              
              <div style={styles.cardContent}>
                <div style={styles.cardHeader}>
                  <span style={styles.instName}>{inst.name}</span>
                  {inst.type === 'sampler' ? <Mic size={12} color="#888"/> : <Music size={12} color="#888"/>}
                </div>
                
                <div style={styles.cardFooter}>
                  <span style={styles.categoryTag}>{inst.category || inst.type}</span>
                  
                  {/* Play Button */}
                  <button 
                    onClick={() => playPreview(inst)}
                    style={styles.previewBtn}
                    title="Preview Sound"
                  >
                    {previewingId === inst.id ? (
                      <Volume2 size={14} color="#fff" className="pulse" />
                    ) : (
                      "▶"
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// 🎨 Styled Objects (Ideally move to CSS Modules or Styled Components)
const styles = {
  container: {
    width: '240px',
    background: '#1e272e',
    borderRight: '1px solid #111',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    color: '#d2dae2',
    fontFamily: 'system-ui, sans-serif',
  },
  header: {
    padding: '15px',
    background: '#2f3640',
    borderBottom: '1px solid #111',
  },
  titleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
  },
  countBadge: {
    background: '#111',
    padding: '2px 8px',
    borderRadius: '10px',
    fontSize: '11px',
    color: '#aaa',
  },
  searchWrapper: {
    display: 'flex',
    alignItems: 'center',
    background: '#111',
    borderRadius: '4px',
    padding: '0 8px',
    marginBottom: '10px',
  },
  searchInput: {
    width: '100%',
    background: 'transparent',
    border: 'none',
    color: 'white',
    padding: '8px',
    fontSize: '12px',
    outline: 'none',
  },
  tabs: {
    display: 'flex',
    gap: '5px',
  },
  tab: {
    flex: 1,
    background: 'transparent',
    border: '1px solid #444',
    color: '#888',
    padding: '4px',
    fontSize: '10px',
    borderRadius: '3px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  activeTab: {
    background: '#0984e3',
    borderColor: '#0984e3',
    color: 'white',
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    padding: '10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  card: {
    display: 'flex',
    background: '#2f3640',
    borderRadius: '4px',
    overflow: 'hidden',
    cursor: 'grab',
    transition: 'transform 0.1s',
    border: '1px solid #353b48',
  },
  colorStrip: {
    width: '6px',
    height: 'auto',
  },
  cardContent: {
    flex: 1,
    padding: '10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontWeight: '600',
    fontSize: '13px',
    color: '#f5f6fa',
  },
  cardFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '4px',
  },
  categoryTag: {
    fontSize: '9px',
    background: '#111',
    padding: '2px 6px',
    borderRadius: '3px',
    color: '#aaa',
    textTransform: 'uppercase',
  },
  previewBtn: {
    background: 'transparent',
    border: '1px solid #555',
    borderRadius: '50%',
    width: '24px',
    height: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '10px',
  },
  emptyState: {
    textAlign: 'center',
    fontSize: '12px',
    color: '#666',
    marginTop: '20px',
  }
};

export default Library;