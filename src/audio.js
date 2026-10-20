/**
 * Procedural Audio & Music Synthesizer for LE THÉÂTRE DES OMBRES
 * Uses Web Audio API so zero external audio files are required.
 */
export class SoundManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.ambientGain = null;
    this.chaseGain = null;
    this.isMuted = false;
    this.initialized = false;
    this.chaseIntensity = 0; // 0.0 to 1.0
    this.musicTimer = null;
    this.noteIndex = 0;
  }

  init() {
    if (this.initialized) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.55;
      this.masterGain.connect(this.ctx.destination);

      this.startAmbientDrone();
      this.startMusicBoxLoop();
      this.initialized = true;
    } catch (e) {
      console.warn('Web Audio API not available:', e);
    }
  }

  resume() {
    if (!this.initialized) this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  startAmbientDrone() {
    if (!this.ctx) return;
    // Deep eerie theater hall resonance (D2 + A2 fifth)
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    this.ambientGain = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc1.frequency.value = 55.0; // A1
    osc2.type = 'triangle';
    osc2.frequency.value = 82.41; // E2

    filter.type = 'lowpass';
    filter.frequency.value = 140;

    this.ambientGain.gain.value = 0.09;

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(this.ambientGain);
    this.ambientGain.connect(this.masterGain);

    osc1.start();
    osc2.start();
  }

  startMusicBoxLoop() {
    if (!this.ctx) return;
    // Haunting waltz melody in A minor / harmonic minor
    const waltzNotes = [
      440.0, 523.25, 659.25, // A4, C5, E5
      440.0, 587.33, 698.46, // A4, D5, F5
      415.3, 493.88, 659.25, // G#4, B4, E5
      440.0, 523.25, 440.0,  // A4, C5, A4
    ];

    const step = () => {
      if (!this.ctx || this.ctx.state !== 'running') {
        this.musicTimer = setTimeout(step, 500);
        return;
      }

      const now = this.ctx.currentTime;
      if (this.chaseIntensity > 0.25) {
        // Urgent heartbeat / timpani pulse during chase or danger
        this.playHeartbeat(now, this.chaseIntensity);
        const interval = Math.max(240, 560 - this.chaseIntensity * 280);
        this.musicTimer = setTimeout(step, interval);
      } else {
        // Delicate distant music box note
        const freq = waltzNotes[this.noteIndex % waltzNotes.length];
        this.noteIndex++;
        this.playMusicBoxNote(freq, 0.04);
        this.musicTimer = setTimeout(step, 680);
      }
    };

    this.musicTimer = setTimeout(step, 600);
  }

  setChaseIntensity(val) {
    this.chaseIntensity = Math.max(0, Math.min(1, val));
  }

  playMusicBoxNote(freq, volume = 0.05) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0005, now + 1.4);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 1.45);
  }

  playHeartbeat(now, intensity) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(85 + intensity * 25, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + 0.22);

    const vol = 0.14 + intensity * 0.22;
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  playFootstep(surface = 'wood') {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    if (surface === 'metal') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320 + Math.random() * 80, now);
      osc.frequency.exponentialRampToValueAtTime(90, now + 0.07);
      gain.gain.setValueAtTime(0.06, now);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(115 + Math.random() * 30, now);
      osc.frequency.exponentialRampToValueAtTime(42, now + 0.08);
      gain.gain.setValueAtTime(0.08, now);
    }
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  playJump() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(290, now + 0.14);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.17);
  }

  playLever() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    // Metallic clank + gear whir
    [220, 165, 340].forEach((f, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, now + idx * 0.07);
      osc.frequency.exponentialRampToValueAtTime(f * 0.6, now + idx * 0.07 + 0.14);
      gain.gain.setValueAtTime(0.11, now + idx * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.16);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now + idx * 0.07);
      osc.stop(now + idx * 0.07 + 0.18);
    });
  }

  playKeyPickup() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const notes = [587.33, 880.0, 1174.66];
    notes.forEach((freq, i) => {
      setTimeout(() => this.playMusicBoxNote(freq, 0.12), i * 90);
    });
  }

  playAlertSting() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    // Dissonant horror brass/string sting
    [146.83, 155.56, 311.13, 466.16].forEach((freq) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.linearRampToValueAtTime(freq * 0.96, now + 0.9);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.95);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 1.0);
    });
  }

  playChandelierCrash() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    // Deep boom + shimmering crystal shatter
    const boom = this.ctx.createOscillator();
    const boomGain = this.ctx.createGain();
    boom.type = 'triangle';
    boom.frequency.setValueAtTime(110, now);
    boom.frequency.exponentialRampToValueAtTime(24, now + 1.4);
    boomGain.gain.setValueAtTime(0.35, now);
    boomGain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
    boom.connect(boomGain);
    boomGain.connect(this.masterGain);
    boom.start(now);
    boom.stop(now + 1.55);

    // Crystal chimes
    for (let i = 0; i < 12; i++) {
      setTimeout(() => {
        this.playMusicBoxNote(900 + Math.random() * 1600, 0.07);
      }, i * 55);
    }
  }
}
