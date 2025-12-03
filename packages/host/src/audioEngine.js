import { on, emit, useStore } from '@music-studio/shared';
import { getFreq } from './musicTheory';

class AudioEngine {
  constructor() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);
    this.masterGain.gain.value = 0.4;

    this.trackChannels = new Map();
    
    // 🔥 CACHE: Map<url, AudioBuffer>
    this.sampleCache = new Map();

    this.current16thNote = 0;
    this.nextNoteTime = 0.0;
    this.timerID = null;
    this.lookahead = 25.0; 
    this.scheduleAheadTime = 0.1;

    this.scheduler = this.scheduler.bind(this);
    this.setupListeners();
    console.log('🔊 Audio Engine: Sampler Ready');
  }
  reset() {
    console.log("♻️ Audio Engine: Resetting Graph...");
    this.stopPlayback();
    
    // Disconnect and clear all channels
    this.trackChannels.forEach((channel) => {
      try {
        channel.input.disconnect();
        channel.output.disconnect();
        channel.effectNodes.forEach(node => {
             // Try to disconnect inner nodes if possible
             if(node.output) node.output.disconnect();
        });
      } catch(e) {}
    });

    this.trackChannels.clear();
    console.log("✅ Audio Engine: Graph Cleared");
  }
 setupListeners() {
    on((event) => {
        if (!event || !event.type) return;
        if (event.type === 'PLAY_TOGGLED') event.payload ? this.startPlayback() : this.stopPlayback();
        else if (event.type === 'PARAM_CHANGE') this.updateEffectParam(event.payload);


        else if (event.type === 'TRACK_VOL_CHANGED') {
        this.updateTrackVolume(event.payload.trackId);
      }
      else if (event.type === 'TRACK_MUTE_SOLO_CHANGED') {
        this.updateMuteSoloState();
      }
      else if (event.type === 'TRACK_DELETED') {
        this.removeTrack(event.payload.trackId);
      }
      if (event.type === 'REMOVE_EFFECT') {
        // The store is already updated by App.js or Timeline.js before this fires?
        // Actually, we should trigger the rebuilding here.
        this.rebuildChain(event.payload.trackId);
      }
    });
  }

  getTrackChannel(trackId) {
    if (!this.trackChannels.has(trackId)) {
      const input = this.ctx.createGain();
      const output = this.ctx.createGain();
      output.connect(this.masterGain);
      input.connect(output); // Default pass-through
      this.trackChannels.set(trackId, { input, output, effectNodes: new Map() });
    }
    return this.trackChannels.get(trackId);
  }

  // --- CHAIN MANAGEMENT ---

  applyEffectToTrack(trackId, effectId, effectFactory) {
    const channel = this.getTrackChannel(trackId);
    const created = effectFactory(this.ctx);
    
    // Normalize Node
    let nodeObj = null;
    if (created.input && created.output) {
      nodeObj = created;
    } else {
      // Wrap single node
      const i = this.ctx.createGain(); 
      const o = this.ctx.createGain();
      i.connect(created); created.connect(o);
      nodeObj = { input: i, output: o, _innerNode: created };
    }

    // Store and Rebuild
    channel.effectNodes.set(effectId, nodeObj);
    this.rebuildChain(trackId);
  }

  rebuildChain(trackId) {
    const channel = this.getTrackChannel(trackId);
    const { tracks } = useStore.getState();
    const trackData = tracks.find(t => t.id === trackId);

    // 1. Disconnect Everything
    try { channel.input.disconnect(); } catch (e) {}
    channel.effectNodes.forEach(node => {
      try { node.output.disconnect(); } catch (e) {}
    });

    // 2. Wiring Loop
    let currentNode = channel.input;
    
    if (trackData && trackData.effects) {
        trackData.effects.forEach(effect => {
            const audioNode = channel.effectNodes.get(effect.id);
            if (audioNode) {
                console.log(`🔗 Link: Track ${trackId} -> ${effect.type}`);
                currentNode.connect(audioNode.input);
                currentNode = audioNode.output;
            }
        });
    }

    // 3. Connect to Output
    currentNode.connect(channel.output);
  }

  updateEffectParam({ trackId, effectId, param, value }) {
    const channel = this.trackChannels.get(trackId);
    if (!channel) return;
    const node = channel.effectNodes.get(effectId);
    if (!node) return;

    if (param === 'wet' && node.wetGain) {
       node.wetGain.gain.setTargetAtTime(value, this.ctx.currentTime, 0.05);
       console.log(`🎛 Param: ${value}`);
    }
  }

  updateTrackVolume(trackId) {
    const channel = this.trackChannels.get(trackId);
    if (!channel) return;

    // Recalculate including Mute/Solo logic
    this.updateMuteSoloState(); 
  }

  // Central Logic for Mute/Solo/Volume
  updateMuteSoloState() {
    const { tracks } = useStore.getState();
    const anySolo = tracks.some(t => t.solo);

    tracks.forEach(track => {
      const channel = this.trackChannels.get(track.id);
      if (!channel) return;

      let targetGain = track.volume || 0.8;

      // MUTE LOGIC
      if (track.muted) {
        targetGain = 0;
      }

      // SOLO LOGIC
      if (anySolo && !track.solo) {
        targetGain = 0;
      }

      // Smooth Ramp to prevent clicking
      // We use the 'output' node of the channel for volume control
      channel.output.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.05);
    });
  }

  // Clean up nodes when deleting a track
  removeTrack(trackId) {
    const channel = this.trackChannels.get(trackId);
    if (!channel) return;

    console.log(`🗑 Removing Track Channel: ${trackId}`);
    
    // Disconnect everything
    try {
      channel.input.disconnect();
      channel.output.disconnect();
      channel.effectNodes.forEach(node => {
        try { node.output.disconnect(); } catch(e){}
      });
    } catch (e) { console.warn(e); }

    this.trackChannels.delete(trackId);
  }
  // --- SEQUENCER & PLAYBACK ---

  startPlayback() {
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.current16thNote = 0;
    this.nextNoteTime = this.ctx.currentTime;
    this.timerID = setInterval(this.scheduler, this.lookahead);
  }

  stopPlayback() {
    clearInterval(this.timerID);
  }

  scheduler() {
    while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAheadTime) {
      this.scheduleNote(this.current16thNote, this.nextNoteTime);
      this.advanceNote();
    }
  }

  advanceNote() {
    import('@music-studio/shared').then(({ emit }) => emit('STEP_CHANGED', this.current16thNote));
    const { tempo, totalSteps } = useStore.getState();
    const secondsPer16th = (60.0 / tempo) / 4;
    this.nextNoteTime += secondsPer16th;
    this.current16thNote = (this.current16thNote + 1) % totalSteps;
  }

  scheduleNote(stepIndex, time) {
    const { tracks } = useStore.getState();
    tracks.forEach(track => {
      track.notes.filter(n => n.step === stepIndex).forEach(note => {
        this.playOscillator(track.id, note.note, time, note.duration || 1);
      });
    });
  }
async loadSample(url) {
    if (!url) return null;
    if (this.sampleCache.has(url)) return this.sampleCache.get(url);

    try {
      console.log(`📥 Fetching sample: ${url}`);
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
      
      this.sampleCache.set(url, audioBuffer);
      return audioBuffer;
    } catch (e) {
      console.error(`❌ Failed to load sample: ${url}`, e);
      return null;
    }
  }

  // 🔥 REPLACED: playOscillator -> playSound
  async playOscillator(trackId, noteName, time, durationSteps) {
    const { tracks, tempo } = useStore.getState();
    const track = tracks.find(t => t.id === trackId);
    if (!track) return;

    const channel = this.getTrackChannel(trackId);
    const secondsPer16th = (60.0 / tempo) / 4;
    const durationSeconds = durationSteps * secondsPer16th;

    // --- LOGIC SPLIT: SYNTH VS SAMPLER ---
    console.log(track.type,track.sampleUrl)
    if (track.type === 'sampler' && track.sampleUrl) {
        // === SAMPLER LOGIC ===
        const buffer = await this.loadSample(track.sampleUrl);
        console.log(buffer)
        if (!buffer) return;

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;

        // PITCH SHIFTING MATH
        // Rate = TargetFreq / RootFreq
        // Assuming sample is C4 (261.63Hz)
        const rootFreq = getFreq(track.rootNote || 'C4');
        const targetFreq = getFreq(noteName);
        source.playbackRate.value = targetFreq / rootFreq;

        // Envelope (Gain)
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.5, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + durationSeconds);

        // Connections
        source.connect(gain);
        gain.connect(channel.input);

        source.start(time);
        // Stop slightly after to allow decay
        source.stop(time + durationSeconds + 0.5); 

    } else {
        // === SYNTH LOGIC (Original) ===
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        let freq = getFreq(noteName);
        if (track.name.toLowerCase().includes('bass')) {
            osc.type = 'sawtooth'; freq = freq / 2;
        } else {
            osc.type = 'square';
        }

        osc.frequency.setValueAtTime(freq, time);
        
        gain.gain.setValueAtTime(0.001, time);
        gain.gain.linearRampToValueAtTime(0.1, time + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, time + durationSeconds);

        osc.connect(gain);
        gain.connect(channel.input);

        osc.start(time);
        osc.stop(time + durationSeconds + 0.1);
    }
  }
}

export const audioEngine = new AudioEngine();