import { EqualizerSettings } from '../types';

export const EQUALIZER_PRESETS: Record<string, { name: string; bass: number; mid: number; treble: number }> = {
  flat: { name: 'Flat (Balanced)', bass: 0, mid: 0, treble: 0 },
  bass_boost: { name: 'Bass Boost', bass: 7, mid: 1, treble: -1 },
  vocal_boost: { name: 'Vocal Clarity', bass: -2, mid: 6, treble: 2 },
  electronic: { name: 'Electronic Dance', bass: 6, mid: -1, treble: 5 },
  acoustic: { name: 'Acoustic / Warm', bass: 3, mid: 3, treble: 3 },
  rock: { name: 'Rock / Dynamic', bass: 5, mid: 2, treble: 4 },
};

const STORAGE_KEY_EQ = 'bitstream_equalizer_settings_v1';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private bassFilter: BiquadFilterNode | null = null;
  private midFilter: BiquadFilterNode | null = null;
  private trebleFilter: BiquadFilterNode | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private eqSettings: EqualizerSettings = {
    bass: 0,
    mid: 0,
    treble: 0,
    preset: 'flat',
  };

  constructor() {
    this.loadStoredSettings();
  }

  private loadStoredSettings() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_EQ);
      if (saved) {
        this.eqSettings = JSON.parse(saved);
      }
    } catch (e) {}
  }

  public getSettings(): EqualizerSettings {
    return { ...this.eqSettings };
  }

  public setSettings(settings: EqualizerSettings) {
    this.eqSettings = { ...settings };
    try {
      localStorage.setItem(STORAGE_KEY_EQ, JSON.stringify(this.eqSettings));
    } catch (e) {}

    this.applyFilters();
  }

  public setPreset(presetKey: string) {
    const preset = EQUALIZER_PRESETS[presetKey];
    if (preset) {
      this.setSettings({
        preset: presetKey,
        bass: preset.bass,
        mid: preset.mid,
        treble: preset.treble,
      });
    }
  }

  private initCtx() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();

        // 3-Band Equalizer Filters
        this.bassFilter = this.ctx.createBiquadFilter();
        this.bassFilter.type = 'lowshelf';
        this.bassFilter.frequency.setValueAtTime(120, this.ctx.currentTime);

        this.midFilter = this.ctx.createBiquadFilter();
        this.midFilter.type = 'peaking';
        this.midFilter.frequency.setValueAtTime(1000, this.ctx.currentTime);
        this.midFilter.Q.setValueAtTime(1.0, this.ctx.currentTime);

        this.trebleFilter = this.ctx.createBiquadFilter();
        this.trebleFilter.type = 'highshelf';
        this.trebleFilter.frequency.setValueAtTime(7000, this.ctx.currentTime);

        // Analyser for Live Visualizer
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 64;
        this.analyser.smoothingTimeConstant = 0.8;

        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(0.85, this.ctx.currentTime);

        // Connect Chain: bass -> mid -> treble -> analyser -> masterGain -> destination
        this.bassFilter.connect(this.midFilter);
        this.midFilter.connect(this.trebleFilter);
        this.trebleFilter.connect(this.analyser);
        this.analyser.connect(this.masterGain);
        this.masterGain.connect(this.ctx.destination);

        this.applyFilters();
      }
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  private applyFilters() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (this.bassFilter) {
      this.bassFilter.gain.setTargetAtTime(this.eqSettings.bass, now, 0.05);
    }
    if (this.midFilter) {
      this.midFilter.gain.setTargetAtTime(this.eqSettings.mid, now, 0.05);
    }
    if (this.trebleFilter) {
      this.trebleFilter.gain.setTargetAtTime(this.eqSettings.treble, now, 0.05);
    }
  }

  // Audition Equalizer with harmonic sound
  public auditionEqualizer() {
    this.initCtx();
    if (!this.ctx || !this.bassFilter) return;

    try {
      const notes = [220, 440, 880]; // Bass, Mid, Treble harmonic test chord
      const now = this.ctx.currentTime;

      notes.forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = idx === 0 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.04);

        gain.gain.setValueAtTime(0.08, now + idx * 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.04 + 0.35);

        osc.connect(gain);
        gain.connect(this.bassFilter!); // Route through EQ!

        osc.start(now + idx * 0.04);
        osc.stop(now + idx * 0.04 + 0.35);
      });
    } catch (e) {}
  }

  // Live frequency data for canvas visualizer
  public getFrequencyData(): Uint8Array {
    if (this.analyser) {
      const data = new Uint8Array(this.analyser.frequencyBinCount);
      this.analyser.getByteFrequencyData(data);
      return data;
    }
    return new Uint8Array(32);
  }

  // Quick subtle UI click / cue sound
  public playCueSound(pitch: number = 880) {
    this.initCtx();
    if (!this.ctx || !this.bassFilter) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(pitch, this.ctx.currentTime);
      gain.gain.setValueAtTime(0.04, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.06);
      osc.connect(gain);
      gain.connect(this.bassFilter);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.06);
    } catch (e) {}
  }

  public setMasterVolume(vol: number) {
    this.initCtx();
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setValueAtTime(Math.max(0, Math.min(1, vol)), this.ctx.currentTime);
    }
  }

  // =========================================================================
  // DUAL-DECK MIXER & AUDIO SYNTHESIS ENGINE
  // Web Audio graph with crossfader, deck equalizers, DJ pads, and beat loops
  // =========================================================================

  private deckAGain: GainNode | null = null;
  private deckBGain: GainNode | null = null;
  private deckABass: BiquadFilterNode | null = null;
  private deckAMid: BiquadFilterNode | null = null;
  private deckATreble: BiquadFilterNode | null = null;
  private deckBBass: BiquadFilterNode | null = null;
  private deckBMid: BiquadFilterNode | null = null;
  private deckBTreble: BiquadFilterNode | null = null;
  private deckAAnalyser: AnalyserNode | null = null;
  private deckBAnalyser: AnalyserNode | null = null;
  private fxBusGain: GainNode | null = null;

  // Synthesis oscillator references for deck sound cues & beat loops
  private activeDrumLoopTimer: number | null = null;
  private currentBpm: number = 120;
  private crossfaderPosition: number = 0.5; // 0.0 (Deck A full) to 1.0 (Deck B full)

  public initMixerGraph() {
    this.initCtx();
    if (!this.ctx || this.deckAGain) return;

    try {
      // Deck A EQ chain
      this.deckABass = this.ctx.createBiquadFilter();
      this.deckABass.type = 'lowshelf';
      this.deckABass.frequency.setValueAtTime(150, this.ctx.currentTime);

      this.deckAMid = this.ctx.createBiquadFilter();
      this.deckAMid.type = 'peaking';
      this.deckAMid.frequency.setValueAtTime(1000, this.ctx.currentTime);
      this.deckAMid.Q.setValueAtTime(1.0, this.ctx.currentTime);

      this.deckATreble = this.ctx.createBiquadFilter();
      this.deckATreble.type = 'highshelf';
      this.deckATreble.frequency.setValueAtTime(6500, this.ctx.currentTime);

      this.deckAGain = this.ctx.createGain();
      this.deckAAnalyser = this.ctx.createAnalyser();
      this.deckAAnalyser.fftSize = 64;

      this.deckABass.connect(this.deckAMid);
      this.deckAMid.connect(this.deckATreble);
      this.deckATreble.connect(this.deckAGain);
      this.deckAGain.connect(this.deckAAnalyser);
      this.deckAAnalyser.connect(this.bassFilter!);

      // Deck B EQ chain
      this.deckBBass = this.ctx.createBiquadFilter();
      this.deckBBass.type = 'lowshelf';
      this.deckBBass.frequency.setValueAtTime(150, this.ctx.currentTime);

      this.deckBMid = this.ctx.createBiquadFilter();
      this.deckBMid.type = 'peaking';
      this.deckBMid.frequency.setValueAtTime(1000, this.ctx.currentTime);
      this.deckBMid.Q.setValueAtTime(1.0, this.ctx.currentTime);

      this.deckBTreble = this.ctx.createBiquadFilter();
      this.deckBTreble.type = 'highshelf';
      this.deckBTreble.frequency.setValueAtTime(6500, this.ctx.currentTime);

      this.deckBGain = this.ctx.createGain();
      this.deckBAnalyser = this.ctx.createAnalyser();
      this.deckBAnalyser.fftSize = 64;

      this.deckBBass.connect(this.deckBMid);
      this.deckBMid.connect(this.deckBTreble);
      this.deckBTreble.connect(this.deckBGain);
      this.deckBGain.connect(this.deckBAnalyser);
      this.deckBAnalyser.connect(this.bassFilter!);

      // FX Bus
      this.fxBusGain = this.ctx.createGain();
      this.fxBusGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
      this.fxBusGain.connect(this.bassFilter!);

      // Apply initial equal-power crossfader
      this.setCrossfader(0.5);
    } catch (e) {
      console.warn('Error creating DJ Mixer Audio graph:', e);
    }
  }

  // Connect an HTML5 audio element directly into Deck A's filter & EQ chain
  private deckASourceNode: MediaElementAudioSourceNode | null = null;
  private deckBSourceNode: MediaElementAudioSourceNode | null = null;

  public attachDeckAudioElement(deck: 'A' | 'B', audioEl: HTMLAudioElement) {
    this.initMixerGraph();
    if (!this.ctx) return;

    try {
      if (deck === 'A' && this.deckABass) {
        if (!this.deckASourceNode) {
          this.deckASourceNode = this.ctx.createMediaElementSource(audioEl);
          this.deckASourceNode.connect(this.deckABass);
        }
      } else if (deck === 'B' && this.deckBBass) {
        if (!this.deckBSourceNode) {
          this.deckBSourceNode = this.ctx.createMediaElementSource(audioEl);
          this.deckBSourceNode.connect(this.deckBBass);
        }
      }
    } catch (e) {
      // Node may already be connected
    }
  }

  // Equal-Power Crossfader formula (cos / sin curve maintains constant loudness)
  public setCrossfader(pos: number) {
    this.initMixerGraph();
    this.crossfaderPosition = Math.max(0, Math.min(1, pos));
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const gainA = Math.cos(this.crossfaderPosition * 0.5 * Math.PI);
    const gainB = Math.sin(this.crossfaderPosition * 0.5 * Math.PI);

    if (this.deckAGain) {
      this.deckAGain.gain.setTargetAtTime(gainA, now, 0.03);
    }
    if (this.deckBGain) {
      this.deckBGain.gain.setTargetAtTime(gainB, now, 0.03);
    }
  }

  public getCrossfader(): number {
    return this.crossfaderPosition;
  }

  // Deck Individual Volume
  public setDeckGain(deck: 'A' | 'B', level: number) {
    this.initMixerGraph();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const targetGain = Math.max(0, Math.min(1.5, level));
    if (deck === 'A' && this.deckAGain) {
      const crossMod = Math.cos(this.crossfaderPosition * 0.5 * Math.PI);
      this.deckAGain.gain.setTargetAtTime(targetGain * crossMod, now, 0.03);
    } else if (deck === 'B' && this.deckBGain) {
      const crossMod = Math.sin(this.crossfaderPosition * 0.5 * Math.PI);
      this.deckBGain.gain.setTargetAtTime(targetGain * crossMod, now, 0.03);
    }
  }

  // 3-Band Deck Equalizer / Isolator (Low, Mid, High)
  public setDeckEq(deck: 'A' | 'B', band: 'low' | 'mid' | 'high', dB: number) {
    this.initMixerGraph();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const clampedDb = Math.max(-24, Math.min(12, dB));

    if (deck === 'A') {
      if (band === 'low' && this.deckABass) this.deckABass.gain.setTargetAtTime(clampedDb, now, 0.04);
      if (band === 'mid' && this.deckAMid) this.deckAMid.gain.setTargetAtTime(clampedDb, now, 0.04);
      if (band === 'high' && this.deckATreble) this.deckATreble.gain.setTargetAtTime(clampedDb, now, 0.04);
    } else {
      if (band === 'low' && this.deckBBass) this.deckBBass.gain.setTargetAtTime(clampedDb, now, 0.04);
      if (band === 'mid' && this.deckBMid) this.deckBMid.gain.setTargetAtTime(clampedDb, now, 0.04);
      if (band === 'high' && this.deckBTreble) this.deckBTreble.gain.setTargetAtTime(clampedDb, now, 0.04);
    }
  }

  // Sound FX Sampler Pads (Airhorn, Vinyl Scratch, Laser Sweep, Sub Bass Drop)
  public triggerSoundFx(fxType: 'airhorn' | 'scratch' | 'sweep' | 'drop' | 'snare') {
    this.initMixerGraph();
    if (!this.ctx || !this.fxBusGain) return;
    const now = this.ctx.currentTime;

    try {
      if (fxType === 'airhorn') {
        // Reggae / DJ Airhorn harmonic blast
        const tones = [587.33, 739.99, 880.0]; // D5, F#5, A5 chord
        tones.forEach((freq) => {
          if (!this.ctx || !this.fxBusGain) return;
          const osc = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, now);

          // Staccato trumpet bursts
          g.gain.setValueAtTime(0, now);
          g.gain.linearRampToValueAtTime(0.08, now + 0.03);
          g.gain.setValueAtTime(0.08, now + 0.16);
          g.gain.linearRampToValueAtTime(0.001, now + 0.22);

          // 2nd blast
          g.gain.setValueAtTime(0, now + 0.26);
          g.gain.linearRampToValueAtTime(0.12, now + 0.29);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

          osc.connect(g);
          g.connect(this.fxBusGain);
          osc.start(now);
          osc.stop(now + 0.7);
        });
      } else if (fxType === 'scratch') {
        // Vinyl scratch friction noise effect
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(1400, now + 0.08);
        osc.frequency.exponentialRampToValueAtTime(180, now + 0.18);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.28);

        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(900, now);
        filter.Q.setValueAtTime(4.0, now);

        g.gain.setValueAtTime(0.15, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        osc.connect(filter);
        filter.connect(g);
        g.connect(this.fxBusGain);
        osc.start(now);
        osc.stop(now + 0.36);
      } else if (fxType === 'sweep') {
        // High-energy White Noise Laser Riser / Filter Sweep
        const bufferSize = this.ctx.sampleRate * 0.8;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(400, now);
        filter.frequency.exponentialRampToValueAtTime(7000, now + 0.75);
        filter.Q.setValueAtTime(5.0, now);

        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.02, now);
        g.gain.linearRampToValueAtTime(0.18, now + 0.6);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

        noise.connect(filter);
        filter.connect(g);
        g.connect(this.fxBusGain);
        noise.start(now);
        noise.stop(now + 0.82);
      } else if (fxType === 'drop') {
        // Sub Bass 808 Impact Drop
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(38, now + 0.6);

        g.gain.setValueAtTime(0.28, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

        osc.connect(g);
        g.connect(this.fxBusGain);
        osc.start(now);
        osc.stop(now + 0.88);
      } else if (fxType === 'snare') {
        // Crisp Drum Snare Hit
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(60, now + 0.1);

        g.gain.setValueAtTime(0.15, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

        osc.connect(g);
        g.connect(this.fxBusGain);
        osc.start(now);
        osc.stop(now + 0.13);
      }
    } catch (e) {}
  }

  // Synthesized Beat Looper / Metronome Overlay (helps mix in sync)
  public toggleBeatLoop(bpm: number = 124): boolean {
    this.initMixerGraph();
    this.currentBpm = bpm;

    if (this.activeDrumLoopTimer !== null) {
      window.clearInterval(this.activeDrumLoopTimer);
      this.activeDrumLoopTimer = null;
      return false;
    }

    const intervalMs = (60 / this.currentBpm) * 1000;
    let step = 0;

    const playBeat = () => {
      if (!this.ctx || !this.fxBusGain) return;
      const now = this.ctx.currentTime;
      const isKick = step % 4 === 0;
      const isSnare = step % 4 === 2;
      const isHiHat = true;

      try {
        if (isKick) {
          // 4-on-the-floor Kick
          const kick = this.ctx.createOscillator();
          const kickGain = this.ctx.createGain();
          kick.type = 'sine';
          kick.frequency.setValueAtTime(130, now);
          kick.frequency.exponentialRampToValueAtTime(45, now + 0.08);

          kickGain.gain.setValueAtTime(0.22, now);
          kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

          kick.connect(kickGain);
          kickGain.connect(this.fxBusGain);
          kick.start(now);
          kick.stop(now + 0.15);
        }

        if (isSnare) {
          this.triggerSoundFx('snare');
        }

        if (isHiHat) {
          // Subtle ticking hi-hat
          const hat = this.ctx.createOscillator();
          const hatGain = this.ctx.createGain();
          hat.type = 'square';
          hat.frequency.setValueAtTime(8000, now);

          hatGain.gain.setValueAtTime(0.015, now);
          hatGain.gain.exponentialRampToValueAtTime(0.0005, now + 0.035);

          hat.connect(hatGain);
          hatGain.connect(this.fxBusGain);
          hat.start(now);
          hat.stop(now + 0.04);
        }
      } catch (e) {}

      step = (step + 1) % 16;
    };

    playBeat();
    this.activeDrumLoopTimer = window.setInterval(playBeat, intervalMs);
    return true;
  }

  public isBeatLoopActive(): boolean {
    return this.activeDrumLoopTimer !== null;
  }

  public stopBeatLoop() {
    if (this.activeDrumLoopTimer !== null) {
      window.clearInterval(this.activeDrumLoopTimer);
      this.activeDrumLoopTimer = null;
    }
  }

  // Live Deck Frequency Meter
  public getDeckFrequencyData(deck: 'A' | 'B'): Uint8Array {
    const analyser = deck === 'A' ? this.deckAAnalyser : this.deckBAnalyser;
    if (analyser) {
      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(data);
      return data;
    }
    return this.getFrequencyData();
  }

  public stopAll() {
    this.stopBeatLoop();
  }
}

export const audioEngine = new AudioEngine();

