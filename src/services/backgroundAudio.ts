/**
 * BitStream Background Audio & Media Keep-Alive Service
 *
 * Keeps Android WebView JavaScript timers and network threads active when
 * the device screen is locked or the app is minimized.
 *
 * It plays an inaudible, looping silent audio track using standard HTML5 Audio.
 * Android's AudioFlinger and Chromium inspect active audio tracks to decide whether
 * to throttle background execution or allow continuous playback.
 */

class BackgroundAudioService {
  private audioEl: HTMLAudioElement | null = null;
  private audioCtx: AudioContext | null = null;
  private isInitialized = false;

  private init() {
    if (this.isInitialized || typeof window === 'undefined') return;

    try {
      // 1. Generate an inaudible 1-second 8-bit mono PCM silent WAV
      const sampleRate = 8000;
      const numSamples = sampleRate; // 1 second of silence
      const buffer = new ArrayBuffer(44 + numSamples);
      const view = new DataView(buffer);

      const writeStr = (offset: number, str: string) => {
        for (let i = 0; i < str.length; i++) {
          view.setUint8(offset + i, str.charCodeAt(i));
        }
      };

      // WAV Header
      writeStr(0, 'RIFF');
      view.setUint32(4, 36 + numSamples, true);
      writeStr(8, 'WAVE');
      writeStr(12, 'fmt ');
      view.setUint32(16, 16, true); // PCM SubChunk size
      view.setUint16(20, 1, true); // Linear PCM format
      view.setUint16(22, 1, true); // 1 Channel (Mono)
      view.setUint32(24, sampleRate, true); // 8000 Hz
      view.setUint32(28, sampleRate, true); // Byte rate (8000 B/s)
      view.setUint16(32, 1, true); // Block align
      view.setUint16(34, 8, true); // 8 bits per sample
      writeStr(36, 'data');
      view.setUint32(40, numSamples, true);

      // 8-bit PCM audio silence center is 128 (0x80)
      const samples = new Uint8Array(buffer, 44, numSamples);
      samples.fill(128);

      const blob = new Blob([buffer], { type: 'audio/wav' });
      const objectUrl = URL.createObjectURL(blob);

      // 2. Instantiate HTML5 Audio element
      this.audioEl = new Audio();
      this.audioEl.src = objectUrl;
      this.audioEl.loop = true;
      // Ultra-low volume (0.01) ensures the audio track is active in Android AudioFlinger
      // without producing any audible sound through speakers or headphones
      this.audioEl.volume = 0.01;
      this.audioEl.setAttribute('playsinline', 'true');
      this.audioEl.setAttribute('webkit-playsinline', 'true');

      // 3. Optional Web Audio Context unlock
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }

      this.isInitialized = true;
    } catch (err) {
      console.warn('[BackgroundAudio] Init error:', err);
    }
  }

  /**
   * Start keep-alive audio stream when playback begins
   */
  public start() {
    this.init();

    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }

    if (this.audioEl) {
      const playPromise = this.audioEl.play();
      if (playPromise !== undefined) {
        playPromise.catch((e) => {
          // May be caught if browser requires prior user interaction
          console.debug('[BackgroundAudio] Keep-alive play awaiting gesture:', e);
        });
      }
    }
  }

  /**
   * Pause keep-alive stream when snippet playback is paused
   */
  public pause() {
    if (this.audioEl && !this.audioEl.paused) {
      this.audioEl.pause();
    }
  }

  /**
   * Stop keep-alive stream when playback completely halts
   */
  public stop() {
    if (this.audioEl) {
      this.audioEl.pause();
      this.audioEl.currentTime = 0;
    }
  }
}

export const backgroundAudio = new BackgroundAudioService();
export default backgroundAudio;
