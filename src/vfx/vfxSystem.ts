export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  gravity: number;
  rotation: number;
  vRot: number;
  shape: 'circle' | 'spark' | 'shard' | 'casing' | 'ring';
}

export interface Tracer {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  width: number;
  life: number;
  maxLife: number;
  isSuper: boolean;
}

export interface MuzzleFlash {
  x: number;
  y: number;
  radius: number;
  color: string;
  life: number;
  maxLife: number;
  rotation: number;
}

export interface FloatingText {
  x: number;
  y: number;
  vy: number;
  text: string;
  subText?: string;
  color: string;
  scale: number;
  life: number;
  maxLife: number;
}

export class VfxSystem {
  private particles: Particle[] = [];
  private tracers: Tracer[] = [];
  private flashes: MuzzleFlash[] = [];
  private texts: FloatingText[] = [];

  public shakeTime = 0;
  public shakeIntensity = 0;
  public hitstopTimer = 0;

  private flashColor = '';
  private flashAlpha = 0;

  public clear(): void {
    this.particles = [];
    this.tracers = [];
    this.flashes = [];
    this.texts = [];
    this.shakeTime = 0;
    this.shakeIntensity = 0;
    this.hitstopTimer = 0;
    this.flashAlpha = 0;
  }

  public addShake(intensity: number, duration: number): void {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    this.shakeTime = Math.max(this.shakeTime, duration);
  }

  public addScreenFlash(color: string, alpha = 0.38): void {
    this.flashColor = color;
    this.flashAlpha = Math.max(this.flashAlpha, alpha);
  }

  public addHitstop(duration: number): void {
    this.hitstopTimer = Math.max(this.hitstopTimer, duration);
  }

  public spawnMuzzleFlash(x: number, y: number, isSuper = false): void {
    this.flashes.push({
      x,
      y,
      radius: isSuper ? 115 : 62,
      color: isSuper ? '#fbbf24' : '#fde047',
      life: isSuper ? 0.22 : 0.14,
      maxLife: isSuper ? 0.22 : 0.14,
      rotation: Math.random() * Math.PI * 2
    });

    // Gunsmoke puffs
    const smokeCount = isSuper ? 16 : 8;
    for (let i = 0; i < smokeCount; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 40 + Math.random() * (isSuper ? 190 : 110);
      this.particles.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 35,
        size: 10 + Math.random() * (isSuper ? 26 : 16),
        color: isSuper ? '#f97316' : '#cbd5e1',
        alpha: 0.45,
        life: 0.35 + Math.random() * 0.35,
        maxLife: 0.7,
        gravity: -25,
        rotation: 0,
        vRot: 0,
        shape: 'circle'
      });
    }

    // Eject brass shell casing
    this.particles.push({
      x: x + 12,
      y: y + 6,
      vx: 110 + Math.random() * 90,
      vy: -170 - Math.random() * 80,
      size: 10,
      color: '#f59e0b',
      alpha: 1,
      life: 0.75,
      maxLife: 0.75,
      gravity: 680,
      rotation: Math.random() * Math.PI,
      vRot: 12,
      shape: 'casing'
    });
  }

  public spawnBulletTracer(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    isSuper = false
  ): void {
    this.tracers.push({
      x1,
      y1,
      x2,
      y2,
      color: isSuper ? '#fbbf24' : '#fef08a',
      width: isSuper ? 14 : 4,
      life: isSuper ? 0.42 : 0.2,
      maxLife: isSuper ? 0.42 : 0.2,
      isSuper
    });

    if (isSuper) {
      // Shockwave rings along beam
      for (let i = 1; i <= 3; i++) {
        const t = i / 4;
        this.particles.push({
          x: x1 + (x2 - x1) * t,
          y: y1 + (y2 - y1) * t,
          vx: 0,
          vy: 0,
          size: 24 + i * 16,
          color: i % 2 === 0 ? '#f43f5e' : '#fbbf24',
          alpha: 0.9,
          life: 0.38,
          maxLife: 0.38,
          gravity: 0,
          rotation: 0,
          vRot: 0,
          shape: 'ring'
        });
      }
    }
  }

  public spawnHitSparks(x: number, y: number, isSuper = false): void {
    const count = isSuper ? 40 : 18;
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 120 + Math.random() * (isSuper ? 520 : 280);
      this.particles.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 40,
        size: isSuper ? 6 + Math.random() * 8 : 3 + Math.random() * 5,
        color: isSuper
          ? (i % 3 === 0 ? '#fbbf24' : '#f43f5e')
          : (i % 2 === 0 ? '#ef4444' : '#fca5a5'),
        alpha: 1,
        life: 0.3 + Math.random() * (isSuper ? 0.45 : 0.28),
        maxLife: 0.75,
        gravity: 380,
        rotation: ang,
        vRot: 0,
        shape: 'spark'
      });
    }

    if (isSuper) {
      this.particles.push({
        x,
        y,
        vx: 0,
        vy: 0,
        size: 130,
        color: '#fbbf24',
        alpha: 1,
        life: 0.42,
        maxLife: 0.42,
        gravity: 0,
        rotation: 0,
        vRot: 0,
        shape: 'ring'
      });
    }
  }

  public spawnShieldBlock(x: number, y: number): void {
    for (let i = 0; i < 24; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 140 + Math.random() * 320;
      this.particles.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        size: 3 + Math.random() * 5,
        color: i % 2 === 0 ? '#38bdf8' : '#e0f2fe',
        alpha: 1,
        life: 0.22 + Math.random() * 0.25,
        maxLife: 0.47,
        gravity: 220,
        rotation: ang,
        vRot: 0,
        shape: 'spark'
      });
    }
    this.particles.push({
      x,
      y,
      vx: 0,
      vy: 0,
      size: 85,
      color: '#38bdf8',
      alpha: 0.85,
      life: 0.28,
      maxLife: 0.28,
      gravity: 0,
      rotation: 0,
      vRot: 0,
      shape: 'ring'
    });
  }

  public spawnShieldShatter(x: number, y: number): void {
    // Flying ballistic armor shards + visor glass chunks
    for (let i = 0; i < 34; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 180 + Math.random() * 480;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 60,
        y: y + (Math.random() - 0.5) * 90,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 120,
        size: 8 + Math.random() * 14,
        color: i % 3 === 0 ? '#93c5fd' : i % 3 === 1 ? '#334155' : '#fbbf24',
        alpha: 1,
        life: 0.55 + Math.random() * 0.45,
        maxLife: 1.0,
        gravity: 780,
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 16,
        shape: 'shard'
      });
    }
    this.spawnHitSparks(x, y, true);
  }

  public spawnReloadGlint(x: number, y: number, isFull: boolean): void {
    const count = isFull ? 24 : 10;
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2;
      const spd = isFull ? 160 : 75;
      this.particles.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 20,
        size: isFull ? 6 : 4,
        color: isFull ? '#fbbf24' : '#fcd34d',
        alpha: 1,
        life: 0.35 + Math.random() * 0.2,
        maxLife: 0.55,
        gravity: -40,
        rotation: ang,
        vRot: 0,
        shape: 'spark'
      });
    }
    if (isFull) {
      this.particles.push({
        x,
        y,
        vx: 0,
        vy: 0,
        size: 110,
        color: '#f59e0b',
        alpha: 0.9,
        life: 0.45,
        maxLife: 0.45,
        gravity: 0,
        rotation: 0,
        vRot: 0,
        shape: 'ring'
      });
    }
  }

  public spawnFloatingText(
    x: number,
    y: number,
    text: string,
    color: string,
    scale = 1,
    subText?: string
  ): void {
    this.texts.push({
      x,
      y,
      vy: -56,
      text,
      subText,
      color,
      scale,
      life: 1.25,
      maxLife: 1.25
    });
  }

  public getShakeOffset(): { x: number; y: number } {
    if (this.shakeTime <= 0) return { x: 0, y: 0 };
    const mag = this.shakeIntensity * Math.min(1, this.shakeTime * 4);
    return {
      x: (Math.random() - 0.5) * 2 * mag,
      y: (Math.random() - 0.5) * 2 * mag
    };
  }

  public update(dt: number): void {
    if (this.hitstopTimer > 0) {
      this.hitstopTimer = Math.max(0, this.hitstopTimer - dt);
      return;
    }

    if (this.shakeTime > 0) {
      this.shakeTime = Math.max(0, this.shakeTime - dt);
      if (this.shakeTime === 0) this.shakeIntensity = 0;
    }

    if (this.flashAlpha > 0) {
      this.flashAlpha = Math.max(0, this.flashAlpha - dt * 1.6);
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rotation += p.vRot * dt;
    }

    for (let i = this.tracers.length - 1; i >= 0; i--) {
      this.tracers[i].life -= dt;
      if (this.tracers[i].life <= 0) this.tracers.splice(i, 1);
    }

    for (let i = this.flashes.length - 1; i >= 0; i--) {
      this.flashes[i].life -= dt;
      if (this.flashes[i].life <= 0) this.flashes.splice(i, 1);
    }

    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt;
      t.y += t.vy * dt;
      t.vy *= 0.94;
      if (t.life <= 0) this.texts.splice(i, 1);
    }
  }

  public render(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.clearRect(0, 0, w, h);

    // Screen flash
    if (this.flashAlpha > 0.01) {
      ctx.save();
      ctx.fillStyle = this.flashColor;
      ctx.globalAlpha = this.flashAlpha;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    // Bullet tracers & Super Shot beams
    for (const tr of this.tracers) {
      const ratio = Math.max(0, tr.life / tr.maxLife);
      ctx.save();
      ctx.lineCap = 'round';
      if (tr.isSuper) {
        // Outer crimson glow
        ctx.strokeStyle = '#f43f5e';
        ctx.globalAlpha = ratio * 0.75;
        ctx.lineWidth = tr.width * 2.6 * ratio;
        ctx.beginPath();
        ctx.moveTo(tr.x1, tr.y1);
        ctx.lineTo(tr.x2, tr.y2);
        ctx.stroke();

        // Mid gold beam
        ctx.strokeStyle = '#fbbf24';
        ctx.globalAlpha = ratio;
        ctx.lineWidth = tr.width * 1.4 * ratio;
        ctx.beginPath();
        ctx.moveTo(tr.x1, tr.y1);
        ctx.lineTo(tr.x2, tr.y2);
        ctx.stroke();

        // White hot core
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = tr.width * 0.55 * ratio;
        ctx.beginPath();
        ctx.moveTo(tr.x1, tr.y1);
        ctx.lineTo(tr.x2, tr.y2);
        ctx.stroke();
      } else {
        ctx.strokeStyle = tr.color;
        ctx.globalAlpha = ratio;
        ctx.lineWidth = tr.width;
        ctx.beginPath();
        ctx.moveTo(tr.x1, tr.y1);
        ctx.lineTo(tr.x2, tr.y2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Comic starburst muzzle flashes
    for (const fl of this.flashes) {
      const ratio = Math.max(0, fl.life / fl.maxLife);
      ctx.save();
      ctx.translate(fl.x, fl.y);
      ctx.rotate(fl.rotation);
      ctx.globalAlpha = ratio;

      const spikes = 9;
      const outer = fl.radius * (0.7 + 0.4 * (1 - ratio));
      const inner = outer * 0.36;
      ctx.beginPath();
      for (let i = 0; i < spikes * 2; i++) {
        const r = i % 2 === 0 ? outer : inner;
        const a = (i * Math.PI) / spikes;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = fl.color;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(0, 0, inner * 0.8, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.restore();
    }

    // Particles
    for (const p of this.particles) {
      const ratio = Math.max(0, p.life / p.maxLife);
      ctx.save();
      ctx.globalAlpha = Math.min(1, p.alpha * ratio);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);

      if (p.shape === 'circle') {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(0, 0, p.size * (1.3 - 0.3 * ratio), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === 'spark') {
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size * 1.4, -p.size * 0.28, p.size * 2.8, p.size * 0.56);
      } else if (p.shape === 'shard') {
        ctx.fillStyle = p.color;
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-p.size * 0.6, -p.size * 0.4);
        ctx.lineTo(p.size * 0.7, -p.size * 0.1);
        ctx.lineTo(p.size * 0.2, p.size * 0.6);
        ctx.lineTo(-p.size * 0.5, p.size * 0.3);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (p.shape === 'casing') {
        ctx.fillStyle = '#f59e0b';
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 1;
        ctx.fillRect(-p.size * 0.55, -p.size * 0.25, p.size * 1.1, p.size * 0.5);
        ctx.strokeRect(-p.size * 0.55, -p.size * 0.25, p.size * 1.1, p.size * 0.5);
      } else if (p.shape === 'ring') {
        const expand = 1.45 - ratio * 0.9;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 5 * ratio;
        ctx.beginPath();
        ctx.arc(0, 0, p.size * expand, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Floating comic damage / callout texts
    for (const t of this.texts) {
      const ratio = Math.max(0, t.life / t.maxLife);
      const pop = ratio > 0.82 ? 1 + (ratio - 0.82) * 2.4 : 1;
      ctx.save();
      ctx.globalAlpha = Math.min(1, ratio * 1.6);
      ctx.translate(t.x, t.y);
      ctx.scale(t.scale * pop, t.scale * pop);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      ctx.font = '900 30px "Segoe UI", "PingFang SC", system-ui, sans-serif';
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#090b10';
      ctx.strokeText(t.text, 0, 0);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, 0, 0);

      if (t.subText) {
        ctx.font = '700 15px "Segoe UI", "PingFang SC", system-ui, sans-serif';
        ctx.lineWidth = 4;
        ctx.strokeText(t.subText, 0, 26);
        ctx.fillStyle = '#f8fafc';
        ctx.fillText(t.subText, 0, 26);
      }
      ctx.restore();
    }
  }
}
