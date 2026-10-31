// Web Audio API procedural sound synthesizer for Veslo
import wildlifeOggUrl from '../assets/wildlife.ogg?url';
import wildlifeMp3Url from '../assets/wildlife.mp3?url';

class SoundSystem {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.engineRunning = false;
    this.wildlifeSample = null;
    this.wildlifePromise = null;
    this.wildlifeSource = null;
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.ctx = new AudioContext();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    this.loadWildlife();
    this.startEngineSound();
  }

  loadWildlife() {
    if (!this.ctx || this.wildlifePromise) return this.wildlifePromise;

    const decode = (url) => fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`Audio fetch failed: ${response.status}`);
        return response.arrayBuffer();
      })
      .then((data) => new Promise((resolve, reject) => {
        this.ctx.decodeAudioData(data, resolve, reject);
      }));

    // Prefer Ogg (crisper soundtrack) and fall back to MP3 where the browser
    // cannot decode Vorbis.
    this.wildlifePromise = decode(wildlifeOggUrl)
      .catch(() => decode(wildlifeMp3Url))
      .then((buffer) => {
        this.wildlifeSample = buffer;
        this.startWildlife();
      })
      .catch(() => {
        this.wildlifeSample = null;
      });

    return this.wildlifePromise;
  }

  startWildlife() {
    if (!this.ctx || !this.wildlifeSample || this.wildlifeSource) return;

    const start = () => {
      try {
        const t = this.ctx.currentTime;
        const source = this.ctx.createBufferSource();
        source.buffer = this.wildlifeSample;
        source.loop = true;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.07, t + 2);

        source.connect(gain);
        gain.connect(this.ctx.destination);
        source.start(t);
        this.wildlifeSource = source;
      } catch (e) {}
    };

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().then(start).catch(() => {});
    } else {
      start();
    }
  }

  startEngineSound() {
    if (!this.ctx || this.engineRunning) return;
    try {
      this.engineOsc = this.ctx.createOscillator();
      this.engineGain = this.ctx.createGain();

      // Motor low rumble
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.setValueAtTime(45, this.ctx.currentTime);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(160, this.ctx.currentTime);

      this.engineGain.gain.setValueAtTime(0.045, this.ctx.currentTime);

      this.engineOsc.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(this.ctx.destination);

      this.engineOsc.start();
      this.engineRunning = true;
    } catch (e) {
      console.warn('Audio init error:', e);
    }
  }

  updateEngine(throttle) {
    if (!this.ctx || !this.engineOsc || !this.engineGain || this.isMuted) return;
    try {
      const t = this.ctx.currentTime;
      const targetFreq = 40 + throttle * 80;
      const targetGain = 0.04 + throttle * 0.09;
      this.engineOsc.frequency.setTargetAtTime(targetFreq, t, 0.08);
      this.engineGain.gain.setTargetAtTime(targetGain, t, 0.08);
    } catch (e) {}
  }

  playWhoosh() {
    if (!this.ctx || this.isMuted) return;
    try {
      const t = this.ctx.currentTime;
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.22);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(300, t);
      filter.frequency.exponentialRampToValueAtTime(1100, t + 0.1);
      filter.frequency.exponentialRampToValueAtTime(200, t + 0.22);
      filter.Q.setValueAtTime(2.2, t);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.22);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      noise.start(t);
    } catch (e) {}
  }

  playSmack() {
    if (!this.ctx || this.isMuted) return;
    try {
      const t = this.ctx.currentTime;
      const pitch = 420 + Math.random() * 100;

      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(pitch, t);
      osc.frequency.exponentialRampToValueAtTime(70, t + 0.12);
      oscGain.gain.setValueAtTime(0.21, t);
      oscGain.gain.exponentialRampToValueAtTime(0.006, t + 0.14);
      osc.connect(oscGain);
      oscGain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.16);

      const sub = this.ctx.createOscillator();
      const subGain = this.ctx.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(160 + Math.random() * 30, t);
      sub.frequency.exponentialRampToValueAtTime(45, t + 0.16);
      subGain.gain.setValueAtTime(0.12, t);
      subGain.gain.exponentialRampToValueAtTime(0.005, t + 0.18);
      sub.connect(subGain);
      subGain.connect(this.ctx.destination);
      sub.start(t);
      sub.stop(t + 0.2);

      const bufferSize = Math.floor(this.ctx.sampleRate * 0.08);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.018));
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1500 + Math.random() * 450, t);
      filter.frequency.exponentialRampToValueAtTime(600, t + 0.08);
      filter.Q.setValueAtTime(0.7, t);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.16, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.006, t + 0.08);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);
      noise.start(t);
    } catch (e) {}
  }

  playRam() {
    // Dull heavy hull thud / boat ram (+50 pts)
    if (!this.ctx || this.isMuted) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(250, t);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(140, t);
      osc.frequency.exponentialRampToValueAtTime(35, t + 0.22);

      gain.gain.setValueAtTime(0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.26);

      // Thud noise
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.15);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      const nFilter = this.ctx.createBiquadFilter();
      nFilter.type = 'lowpass';
      nFilter.frequency.setValueAtTime(320, t);
      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(0.25, t);
      nGain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);

      noise.connect(nFilter);
      nFilter.connect(nGain);
      nGain.connect(this.ctx.destination);
      noise.start(t);
    } catch (e) {}
  }

  playPropellerShred() {
    // Rapid propeller blade slice / shred buzz (+500 pts)
    if (!this.ctx || this.isMuted) return;
    try {
      const t = this.ctx.currentTime;

      // High RPM chop oscillator
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(650, t);
      filter.frequency.linearRampToValueAtTime(900, t + 0.15);
      filter.frequency.linearRampToValueAtTime(300, t + 0.3);
      filter.Q.setValueAtTime(3.0, t);

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, t);
      osc.frequency.linearRampToValueAtTime(260, t + 0.1);
      osc.frequency.linearRampToValueAtTime(90, t + 0.3);

      gain.gain.setValueAtTime(0.28, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.32);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.35);

      // Splatter burst noise
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.28);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        // Choppy bursts
        const chop = (Math.sin(i * 0.12) > 0 ? 1 : 0.3);
        data[i] = (Math.random() * 2 - 1) * chop * Math.exp(-i / (this.ctx.sampleRate * 0.12));
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(0.35, t);
      nGain.gain.exponentialRampToValueAtTime(0.01, t + 0.28);

      noise.connect(nGain);
      nGain.connect(this.ctx.destination);
      noise.start(t);
    } catch (e) {}
  }

  playSplash() {
    if (!this.ctx || this.isMuted) return;
    try {
      const t = this.ctx.currentTime;

      const bufferSize = Math.floor(this.ctx.sampleRate * 0.18);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2400 + Math.random() * 500, t);
      filter.frequency.exponentialRampToValueAtTime(700, t + 0.18);
      filter.Q.setValueAtTime(0.7, t);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.1, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.004, t + 0.18);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);
      noise.start(t);

      for (let i = 0; i < 3; i++) {
        const start = t + 0.015 + i * (0.035 + Math.random() * 0.02);
        const freq = 220 + Math.random() * 260;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.7, start + 0.06);

        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.035 + Math.random() * 0.015, start + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0005, start + 0.07);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(start);
        osc.stop(start + 0.08);
      }
    } catch (e) {}
  }

  playWildlifeDiveIn() {
    this.playWildlifePop(560, 170, 0.13);
  }

  playWildlifeDiveOut() {
    this.playWildlifePop(210, 620, 0.11);
  }

  playWildlifePop(startFreq, endFreq, volume) {
    if (!this.ctx || this.isMuted) return;
    try {
      const t = this.ctx.currentTime;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(startFreq, t);
      osc.frequency.exponentialRampToValueAtTime(endFreq, t + 0.09);

      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(volume, t + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0004, t + 0.12);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.14);

      const bufferSize = Math.floor(this.ctx.sampleRate * 0.1);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        const env = Math.exp(-i / (this.ctx.sampleRate * 0.025));
        data[i] = (Math.random() * 2 - 1) * env;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1500, t);
      filter.Q.setValueAtTime(1.2, t);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.05, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.002, t + 0.1);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);
      noise.start(t);
    } catch (e) {}
  }

  playFrogRibbit() {
    if (!this.ctx || this.isMuted) return;
    try {
      const t = this.ctx.currentTime;

      for (let i = 0; i < 2; i++) {
        const start = t + i * 0.14;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(900, start);
        filter.frequency.exponentialRampToValueAtTime(380, start + 0.12);

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, start);
        osc.frequency.exponentialRampToValueAtTime(88, start + 0.1);

        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.2, start + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.12);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(start);
        osc.stop(start + 0.13);
      }

      const bufferSize = Math.floor(this.ctx.sampleRate * 0.18);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.04));
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      const noiseFilter = this.ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(700, t);
      noiseFilter.Q.setValueAtTime(1.4, t);
      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.06, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.004, t + 0.18);

      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);
      noise.start(t);
    } catch (e) {}
  }

  playSnakeHiss() {
    if (!this.ctx || this.isMuted) return;
    try {
      const t = this.ctx.currentTime;
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.55);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        const env = Math.min(1, i / (this.ctx.sampleRate * 0.05)) *
          Math.exp(-i / (this.ctx.sampleRate * 0.3));
        const rasp = 0.7 + 0.3 * Math.sin(i * 0.05);
        data[i] = (Math.random() * 2 - 1) * env * rasp;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(2200, t);
      filter.frequency.exponentialRampToValueAtTime(4200, t + 0.4);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.22, t);
      gain.gain.exponentialRampToValueAtTime(0.005, t + 0.55);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      noise.start(t);
    } catch (e) {}
  }

  playAlert() {
    // Rank-up chime: short ascending three-note confirmation
    if (!this.ctx || this.isMuted) return;
    try {
      const t = this.ctx.currentTime;
      const notes = [660, 880, 1320];

      notes.forEach((freq, i) => {
        const start = t + i * 0.11;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.16, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(start);
        osc.stop(start + 0.24);
      });
    } catch (e) {}
  }

  playGameOver() {
    // Gentle & lower volume game over alert (toned down per user request)
    if (!this.ctx || this.isMuted) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      // Soft lowpass filter to remove harsh edge
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(350, t);

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, t);
      osc.frequency.linearRampToValueAtTime(110, t + 0.7);

      // Low volume: 0.1 instead of 0.3
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.linearRampToValueAtTime(0.01, t + 0.75);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.8);
    } catch (e) {}
  }
}

export const sound = new SoundSystem();
