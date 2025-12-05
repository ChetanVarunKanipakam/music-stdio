import { create } from 'zustand';

export const useStore = create((set, get) => ({
  // ... existing state ...
  isPlaying: false,
  tempo: 120,
  totalSteps: 16,
  
  tracks: [
    { 
      id: 1, name: 'Retro Synth', type: 'synth', 
      effects: [], notes: [],
      // 🔥 NEW FIELDS
      volume: 0.8, muted: false, solo: false
    }
  ],

  // ... existing actions (setIsPlaying, setTempo, etc) ...
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setTempo: (bpm) => set({ tempo: bpm }),
  setTotalSteps: (steps) => set({ totalSteps: steps }),

  addTrack: (payload) => set((state) => ({
    tracks: [...state.tracks, { 
      id: Date.now(), 
      name: payload?.name || 'New Track', 
      type: payload?.type || 'synth', 
      sampleUrl: payload?.sampleUrl || null,
      rootNote: payload?.rootNote || 'C4',
      effects: [], notes: [],
      // 🔥 NEW DEFAULTS
      volume: 0.8, muted: false, solo: false
    }]
  })),

  // 🔥 NEW MIXER ACTIONS
  setTrackVolume: (trackId, vol) => set((state) => ({
    tracks: state.tracks.map(t => t.id === trackId ? { ...t, volume: vol } : t)
  })),

  toggleTrackMute: (trackId) => set((state) => ({
    tracks: state.tracks.map(t => t.id === trackId ? { ...t, muted: !t.muted } : t)
  })),

  toggleTrackSolo: (trackId) => set((state) => ({
    tracks: state.tracks.map(t => {
      // Logic: If clicking solo on a track that is already soloed, un-solo it.
      // If clicking solo on a new track, keep others soloed? (DAW standard is usually additive or exclusive).
      // Let's go simple: Toggle specific track solo.
      return t.id === trackId ? { ...t, solo: !t.solo } : t
    })
  })),

  // 🔥 DELETE TRACK
  deleteTrack: (trackId) => set((state) => ({
    tracks: state.tracks.filter(t => t.id !== trackId)
  })),

  // ... existing note/effect actions ...
  addNote: (trackId, noteObj) => set((state) => ({
    tracks: state.tracks.map(t => {
      if (t.id !== trackId) return t;
      const filtered = t.notes.filter(n => n.step !== noteObj.step);
      return { ...t, notes: [...filtered, noteObj] };
    })
  })),
  deleteNote: (trackId, step) => set((state) => ({
    tracks: state.tracks.map(t => t.id === trackId ? { ...t, notes: t.notes.filter(n => n.step !== step) } : t)
  })),
  modifyNote: (trackId, oldStep, newStep, newDuration) => set((state) => ({
    tracks: state.tracks.map(t => {
      if (t.id !== trackId) return t;
      return { ...t, notes: t.notes.map(n => n.step === oldStep ? { ...n, step: newStep, duration: newDuration } : n) };
    })
  })),
  addEffectToTrack: (trackId, effectType) => set((state) => {
    const newEffect = { id: Date.now() + Math.random(), type: effectType, params: { wet: 0.8 } };
    return { tracks: state.tracks.map(t => t.id === trackId ? { ...t, effects: [...t.effects, newEffect] } : t) };
  }),
  removeEffectFromTrack: (trackId, effectId) => set((state) => ({
    tracks: state.tracks.map(t => 
      t.id === trackId 
        ? { ...t, effects: t.effects.filter(e => e.id !== effectId) }
        : t
    )
  })),
  updateEffectParam: (trackId, effectId, param, value) => set((state) => ({
    tracks: state.tracks.map(t => {
      if (t.id !== trackId) return t;
      return { ...t, effects: t.effects.map(e => e.id === effectId ? { ...e, params: { ...e.params, [param]: value } } : e) };
    })
  })),
  loadProject: (projectData) => set((state) => ({
    ...state,
    tempo: projectData.tempo,
    totalSteps: projectData.totalSteps,
    tracks: projectData.tracks,
    isPlaying: false
  })),

}));