export type BgmTrack = 'none' | 'title' | 'battle';

class SoundManager {
  private ctx: AudioContext | null = null;
  private muted = false;
  private unlocked = false;

  private titleAudio: HTMLAudioElement | null = null;
  private battleAudio: HTMLAudioElement | null = null;
  private currentTrack: BgmTrack = 'none';
  private pendingTrack: BgmTrack = 'none';

  public init(): void {
    if (this.titleAudio) return;

    this.titleAudio = new Audio('./assets/audio/Twelve_Paces_Apart.mp3');
    this.titleAudio.loop = true;
    this.titleAudio.volume = 0.42;
    this.titleAudio.preload = 'metadata';

    this.battleAudio = new Audio('./assets/audio/Between_Ticks_and_Steel.mp3');
    this.battleAudio.loop = true;
    this.battleAudio.volume = 0.46;
    this.battleAudio.preload = 'metadata';

    const unlockHandler = () => {
      this.unlockAudio();
    };
    window.addEventListener('pointerdown', unlockHandler, { passive: true });
    window.addEventListener('keydown', unlockHandler, { passive: true });
  }

  public unlockAudio(): void {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    this.unlocked = true;
    if (this.pendingTrack !== 'none' && !this.muted) {
      const track = this.pendingTrack;
      this.pendingTrack = 'none';
      this.playBgm(track);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.muted) {
      this.titleAudio?.pause();
      this.battleAudio?.pause();
    } else {
      this.unlockAudio();
      if (this.currentTrack !== 'none') {
        const track = this.currentTrack;
        this.currentTrack = 'none';
        this.playBgm(track);
      }
    }
    return this.muted;
  }

  public playBgm(track: BgmTrack): void {
    this.init();
    if (this.currentTrack === track) return;

    this.titleAudio?.pause();
    this.battleAudio?.pause();

    this.currentTrack = track;
    if (this.muted || track === 'none') return;

    const target = track === 'title' ? this.titleAudio : this.battleAudio;
    if (!target) return;

    try {
      if (target.readyState >= 1) {
        target.currentTime = 0;
      }
      const p = target.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => {
          this.pendingTrack = track;
          this.currentTrack = 'none';
        });
      }
    } catch {
      this.pendingTrack = track;
      this.currentTrack = 'none';
    }
  }

  private getCtx(): AudioContext | null {
    if (this.muted) return null;
    if (!this.unlocked) this.unlockAudio();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public playTick(urgent = false): void {
    const ctx = this.getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = urgent ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(urgent ? 980 : 620, now);
    osc.frequency.exponentialRampToValueAtTime(urgent ? 440 : 280, now + 0.045);

    gain.gain.setValueAtTime(urgent ? 0.14 : 0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  public playLock(): void {
    const ctx = this.getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.setValueAtTime(780, now + 0.04);

    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  public playReload(): void {
    const ctx = this.getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Double metallic click simulating brass cartridge + cylinder snap
    [0, 0.09, 0.17].forEach((offset, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1100 + i * 260, now + offset);
      osc.frequency.exponentialRampToValueAtTime(340, now + offset + 0.05);
      gain.gain.setValueAtTime(0.12, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.06);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.065);
    });
  }

  public playShieldUp(): void {
    const ctx = this.getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(170, now);
    osc.frequency.exponentialRampToValueAtTime(62, now + 0.16);
    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  public playGunshot(isSuper = false): void {
    const ctx = this.getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dur = isSuper ? 0.55 : 0.28;

    // White noise burst through bandpass/lowpass
    const bufferSize = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * (isSuper ? 0.14 : 0.06)));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(isSuper ? 3200 : 2200, now);
    filter.frequency.exponentialRampToValueAtTime(220, now + dur);

    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(isSuper ? 0.45 : 0.3, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(ctx.destination);
    noise.start(now);

    // Punchy low-end body
    const osc = ctx.createOscillator();
    const oGain = ctx.createGain();
    osc.type = isSuper ? 'sawtooth' : 'sine';
    osc.frequency.setValueAtTime(isSuper ? 260 : 180, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + (isSuper ? 0.36 : 0.16));
    oGain.gain.setValueAtTime(isSuper ? 0.36 : 0.25, now);
    oGain.gain.exponentialRampToValueAtTime(0.001, now + (isSuper ? 0.38 : 0.18));
    osc.connect(oGain);
    oGain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + (isSuper ? 0.4 : 0.2));
  }

  public playShieldBlock(): void {
    const ctx = this.getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1450, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.18);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.21);
  }

  public playShieldShatter(): void {
    const ctx = this.getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    // High glass/metal shrapnel bursts
    [0, 0.03, 0.07, 0.12].forEach((offset, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(2200 - idx * 320, now + offset);
      osc.frequency.exponentialRampToValueAtTime(180, now + offset + 0.14);
      gain.gain.setValueAtTime(0.16, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.16);
    });
  }

  public playForfeit(): void {
    const ctx = this.getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.linearRampToValueAtTime(125, now + 0.25);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.3);
  }

  public playGameOver(victory: boolean): void {
    const ctx = this.getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = victory ? [330, 440, 554.37, 659.25] : [293.66, 261.63, 220, 174.61];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = victory ? 'triangle' : 'sawtooth';
      osc.frequency.setValueAtTime(freq, now + i * 0.11);
      gain.gain.setValueAtTime(0.14, now + i * 0.11);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.11 + 0.42);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.11);
      osc.stop(now + i * 0.11 + 0.45);
    });
  }
}

export const soundManager = new SoundManager();
