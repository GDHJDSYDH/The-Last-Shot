import { Fighter, FighterId, TurnPhase } from '../core/types';

export interface OpponentHitbox {
  fighterId: FighterId;
  x: number;
  y: number;
  w: number;
  h: number;
  centerX: number;
  centerY: number;
  headY: number;
  muzzleX: number;
  muzzleY: number;
}

interface DustMote {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  a: number;
}

export class SceneRenderer {
  private bgImg: HTMLImageElement;
  private revolverSideImg: HTMLImageElement;
  private revolverAimedImg: HTMLImageElement;
  private shieldEnemyImg: HTMLImageElement;

  private dust: DustMote[] = [];
  private time = 0;

  constructor() {
    this.bgImg = this.loadImg('./assets/images/scene_bg.png');
    this.revolverSideImg = this.loadImg('./assets/images/revolver_side.png');
    this.revolverAimedImg = this.loadImg('./assets/images/revolver_aimed_at_player.png');
    this.shieldEnemyImg = this.loadImg('./assets/images/shield_enemy.png');

    for (let i = 0; i < 34; i++) {
      this.dust.push({
        x: Math.random(),
        y: Math.random(),
        r: 1 + Math.random() * 2.2,
        vx: (Math.random() - 0.5) * 0.014,
        vy: -0.008 - Math.random() * 0.015,
        a: 0.12 + Math.random() * 0.35
      });
    }
  }

  private loadImg(src: string): HTMLImageElement {
    const img = new Image();
    img.src = src;
    return img;
  }

  private isReady(img: HTMLImageElement): boolean {
    return img.complete && img.naturalWidth > 0;
  }

  private getBgMetrics(w: number, h: number): { dx: number; dy: number; dw: number; dh: number; tableTopY: number } {
    if (this.isReady(this.bgImg)) {
      const iw = this.bgImg.naturalWidth;
      const ih = this.bgImg.naturalHeight;
      const scale = Math.max(w / iw, h / ih);
      const dw = iw * scale;
      const dh = ih * scale;
      const dx = (w - dw) * 0.5;
      const dy = (h - dh) * 0.5;
      // In scene_bg.png, the top edge of the duel table sits at ~79.5% of image height
      const tableTopY = Math.min(h * 0.84, Math.max(h * 0.68, dy + dh * 0.795));
      return { dx, dy, dw, dh, tableTopY };
    }
    return { dx: 0, dy: 0, dw: w, dh: h, tableTopY: h * 0.76 };
  }

  public computeHitboxes(
    opponents: Fighter[],
    w: number,
    h: number
  ): OpponentHitbox[] {
    const isPortrait = h > w;
    const { tableTopY } = this.getBgMetrics(w, h);
    const figScale = Math.min(w, h) * (opponents.length > 1 ? (isPortrait ? 0.0028 : 0.00295) : (isPortrait ? 0.00345 : 0.00345));
    const unit = Math.max(0.62, Math.min(1.52, figScale));

    return opponents.map((f) => {
      const cx = w * f.slotX;
      const hipY = tableTopY + 18 * unit;
      const bodyH = 225 * unit;
      const headY = hipY - bodyH * 0.86;
      const boxW = 152 * unit;
      const boxH = 248 * unit;

      return {
        fighterId: f.id,
        x: cx - boxW * 0.5,
        y: headY - 48 * unit,
        w: boxW,
        h: boxH,
        centerX: cx,
        centerY: hipY - bodyH * 0.45,
        headY,
        muzzleX: cx + (f.pose === 'aim_side' || f.pose === 'fire_side' ? (f.slotX < 0.5 ? 86 * unit : -86 * unit) : 22 * unit),
        muzzleY: hipY - bodyH * 0.52
      };
    });
  }

  public render(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    opponents: Fighter[],
    phase: TurnPhase,
    hoveredTargetId: FighterId | null,
    shakeOffset: { x: number; y: number },
    dt: number
  ): OpponentHitbox[] {
    this.time += dt;
    ctx.save();
    ctx.clearRect(0, 0, w, h);
    ctx.translate(shakeOffset.x, shakeOffset.y);

    // 1. Background image (cover-fit) or procedural fallback
    this.drawBackground(ctx, w, h);

    // 2. Dynamic overhead spotlight cone & floating noir dust
    this.drawAtmosphere(ctx, w, h, dt);

    // 3. Draw stickman opponents standing BEHIND the table
    const hitboxes = this.computeHitboxes(opponents, w, h);
    const { tableTopY } = this.getBgMetrics(w, h);

    for (let i = 0; i < opponents.length; i++) {
      const f = opponents[i];
      const hb = hitboxes[i];
      const isHovered = phase === 'aiming' && hoveredTargetId === f.id && f.alive;
      this.drawStylizedStickman(ctx, f, hb, tableTopY, opponents.length > 1, isHovered, phase);
    }

    // 4. Foreground table slice from scene_bg.png so opponents stand seamlessly BEHIND the real table!
    this.drawTableForegroundEdge(ctx, w, h, tableTopY);

    ctx.restore();
    return hitboxes;
  }

  private drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (this.isReady(this.bgImg)) {
      const { dx, dy, dw, dh } = this.getBgMetrics(w, h);
      ctx.drawImage(this.bgImg, dx, dy, dw, dh);

      // Subtle dark vignette for HUD contrast
      const grad = ctx.createRadialGradient(w * 0.5, h * 0.42, w * 0.14, w * 0.5, h * 0.5, Math.max(w, h) * 0.78);
      grad.addColorStop(0, 'rgba(10, 12, 18, 0.04)');
      grad.addColorStop(1, 'rgba(5, 6, 10, 0.58)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    } else {
      const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
      bgGrad.addColorStop(0, '#090b10');
      bgGrad.addColorStop(0.65, '#151923');
      bgGrad.addColorStop(1, '#0b0d12');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);
    }
  }

  private drawAtmosphere(ctx: CanvasRenderingContext2D, w: number, h: number, dt: number): void {
    const flicker = 0.94 + Math.sin(this.time * 5.2) * 0.03 + Math.sin(this.time * 13.7) * 0.02;
    ctx.save();
    const cone = ctx.createRadialGradient(w * 0.5, h * 0.05, 10, w * 0.5, h * 0.52, Math.max(w, h) * 0.55);
    cone.addColorStop(0, `rgba(251, 191, 36, ${0.15 * flicker})`);
    cone.addColorStop(0.45, `rgba(245, 158, 11, ${0.05 * flicker})`);
    cone.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = cone;
    ctx.fillRect(0, 0, w, h);

    // Dust motes drifting in the spotlight
    ctx.fillStyle = '#fde68a';
    for (const d of this.dust) {
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      if (d.y < 0) {
        d.y = 0.8;
        d.x = Math.random();
      }
      if (d.x < 0) d.x = 1;
      if (d.x > 1) d.x = 0;

      ctx.globalAlpha = d.a * flicker;
      ctx.beginPath();
      ctx.arc(d.x * w, d.y * h, d.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawTableForegroundEdge(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    tableTopY: number
  ): void {
    ctx.save();
    if (this.isReady(this.bgImg)) {
      // Re-draw ONLY the table region (below tableTopY) from scene_bg.png on top of stickmen's lower torso
      // so opponents are naturally occluded behind the real wooden/slate table!
      ctx.beginPath();
      ctx.rect(0, tableTopY, w, h - tableTopY);
      ctx.clip();
      const { dx, dy, dw, dh } = this.getBgMetrics(w, h);
      ctx.drawImage(this.bgImg, dx, dy, dw, dh);
      // Slight bottom fade so action buttons sit cleanly
      const fade = ctx.createLinearGradient(0, tableTopY, 0, h);
      fade.addColorStop(0, 'rgba(6, 7, 10, 0.05)');
      fade.addColorStop(1, 'rgba(6, 7, 10, 0.68)');
      ctx.fillStyle = fade;
      ctx.fillRect(0, tableTopY, w, h - tableTopY);
    } else {
      const tableGrad = ctx.createLinearGradient(0, tableTopY, 0, h);
      tableGrad.addColorStop(0, 'rgba(28, 24, 22, 0.92)');
      tableGrad.addColorStop(1, 'rgba(6, 7, 10, 0.95)');
      ctx.fillStyle = tableGrad;
      ctx.fillRect(0, tableTopY, w, h - tableTopY);
    }
    ctx.restore();
  }

  private drawStylizedStickman(
    ctx: CanvasRenderingContext2D,
    f: Fighter,
    hb: OpponentHitbox,
    tableTopY: number,
    isTriple: boolean,
    isHovered: boolean,
    phase: TurnPhase
  ): void {
    const unit = hb.w / 148;
    const cx = hb.centerX;
    const breath = Math.sin(f.breathPhase) * 3.5 * unit;
    const hurtOffset = f.hitFlash > 0 ? Math.sin(f.hitFlash * 28) * 10 * unit : 0;
    const recoilOffset = f.recoil * 14 * unit;
    const deathDrop = f.deathAnim * 135 * unit;
    const deathTilt = f.deathAnim * (f.slotX < 0.5 ? -0.45 : 0.45);

    ctx.save();
    ctx.translate(cx + hurtOffset, tableTopY + 14 * unit + deathDrop);
    ctx.rotate(deathTilt);

    if (!f.alive) {
      ctx.globalAlpha = Math.max(0.26, 1 - f.deathAnim * 0.72);
    }

    // Super Shot 6-ammo menacing energy aura behind opponent!
    if (f.alive && f.ammo >= f.maxAmmo) {
      const pulse = 0.75 + Math.sin(this.time * 9) * 0.25;
      const auraGrad = ctx.createRadialGradient(0, -110 * unit, 10, 0, -110 * unit, 125 * unit);
      auraGrad.addColorStop(0, `rgba(251, 191, 36, ${0.42 * pulse})`);
      auraGrad.addColorStop(0.55, `rgba(225, 29, 72, ${0.24 * pulse})`);
      auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = auraGrad;
      ctx.beginPath();
      ctx.arc(0, -110 * unit, 125 * unit, 0, Math.PI * 2);
      ctx.fill();
    }

    // Aiming target lock highlight ring
    if (phase === 'aiming' && f.alive) {
      ctx.save();
      ctx.strokeStyle = isHovered ? '#fbbf24' : 'rgba(248, 113, 113, 0.55)';
      ctx.lineWidth = isHovered ? 3.5 : 2;
      ctx.setLineDash([10, 7]);
      ctx.beginPath();
      ctx.roundRect(-64 * unit, -225 * unit, 128 * unit, 222 * unit, 18 * unit);
      ctx.stroke();

      if (isHovered) {
        ctx.fillStyle = 'rgba(251, 191, 36, 0.12)';
        ctx.fill();
      }
      ctx.restore();
    }

    // Key skeleton anchor points (relative to hip at table level)
    const shoulderY = -128 * unit + breath + recoilOffset * 0.35;
    const headCenterY = -176 * unit + breath + recoilOffset * 0.45;
    const headR = 30 * unit;

    const inkStroke = f.hitFlash > 0.35 ? '#fff1f2' : '#090b10';
    const bodyFill = f.hitFlash > 0.35 ? '#f43f5e' : '#12151e';
    const rimColor = f.hitFlash > 0.35 ? '#ffffff' : f.accentColor;

    // --- Stylish Noir Trench-Coat Stickman Torso Silhouette (matches cover.png!) ---
    ctx.save();
    ctx.fillStyle = bodyFill;
    ctx.strokeStyle = rimColor;
    ctx.lineWidth = 2.6 * unit;
    ctx.beginPath();
    ctx.moveTo(-29 * unit, shoulderY);
    ctx.quadraticCurveTo(0, shoulderY - 10 * unit, 29 * unit, shoulderY);
    ctx.lineTo(22 * unit, 12 * unit);
    ctx.lineTo(-22 * unit, 12 * unit);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Upturned noir coat collar lapels
    ctx.fillStyle = '#0c0f17';
    ctx.strokeStyle = rimColor;
    ctx.lineWidth = 2 * unit;
    ctx.beginPath();
    ctx.moveTo(-25 * unit, shoulderY + 2 * unit);
    ctx.lineTo(-14 * unit, shoulderY - 18 * unit);
    ctx.lineTo(-5 * unit, shoulderY + 6 * unit);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(25 * unit, shoulderY + 2 * unit);
    ctx.lineTo(14 * unit, shoulderY - 18 * unit);
    ctx.lineTo(5 * unit, shoulderY + 6 * unit);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Flowing stylized necktie!
    const tieWave = Math.sin(this.time * 3.4 + f.breathPhase) * 6 * unit;
    ctx.fillStyle = f.accentColor;
    ctx.beginPath();
    ctx.moveTo(-5 * unit, shoulderY + 3 * unit);
    ctx.lineTo(5 * unit, shoulderY + 3 * unit);
    ctx.lineTo(11 * unit + tieWave * 0.7, shoulderY + 58 * unit);
    ctx.lineTo(tieWave * 1.15, shoulderY + 76 * unit);
    ctx.lineTo(-9 * unit + tieWave * 0.4, shoulderY + 58 * unit);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#090b10';
    ctx.lineWidth = 1.8 * unit;
    ctx.stroke();
    ctx.restore();

    // --- Back Arm & Front Arm + Props according to Pose ---
    const sideDir = f.slotX < 0.5 ? 1 : -1;

    if (f.pose === 'defend') {
      // Arms bracing shield
      this.drawLimb(ctx, -24 * unit, shoulderY + 6 * unit, -42 * unit, shoulderY + 42 * unit, -12 * unit, shoulderY + 50 * unit, unit, bodyFill, rimColor);
      this.drawLimb(ctx, 24 * unit, shoulderY + 6 * unit, 44 * unit, shoulderY + 42 * unit, 14 * unit, shoulderY + 50 * unit, unit, bodyFill, rimColor);
    } else if (f.pose === 'aim_player' || f.pose === 'fire_player') {
      // Left arm poised back, right arm extended forward pointing straight at the player!
      this.drawLimb(ctx, -24 * unit, shoulderY + 6 * unit, -48 * unit, shoulderY + 45 * unit, -32 * unit, shoulderY + 84 * unit, unit, bodyFill, rimColor);
      this.drawLimb(ctx, 24 * unit, shoulderY + 6 * unit, 36 * unit, shoulderY + 26 * unit, 20 * unit, shoulderY + 22 * unit - recoilOffset, unit, bodyFill, rimColor);
    } else if (f.pose === 'aim_side' || f.pose === 'fire_side') {
      // Aiming sideways toward the other AI in 1v1v1!
      this.drawLimb(ctx, -24 * unit * sideDir, shoulderY + 6 * unit, -44 * unit * sideDir, shoulderY + 44 * unit, -28 * unit * sideDir, shoulderY + 80 * unit, unit, bodyFill, rimColor);
      this.drawLimb(ctx, 22 * unit * sideDir, shoulderY + 6 * unit, 52 * unit * sideDir, shoulderY + 14 * unit, 76 * unit * sideDir, shoulderY + 10 * unit, unit, bodyFill, rimColor);
    } else if (f.pose === 'reload') {
      // Reload pose: hands brought to chest spinning revolver cylinder
      const lift = Math.sin(f.reloadAnim * Math.PI) * 14 * unit;
      this.drawLimb(ctx, -24 * unit, shoulderY + 6 * unit, -44 * unit, shoulderY + 38 * unit, -14 * unit, shoulderY + 34 * unit - lift, unit, bodyFill, rimColor);
      this.drawLimb(ctx, 24 * unit, shoulderY + 6 * unit, 44 * unit, shoulderY + 36 * unit, 16 * unit, shoulderY + 30 * unit - lift, unit, bodyFill, rimColor);
    } else if (f.pose === 'hurt') {
      // Flinching backward
      this.drawLimb(ctx, -24 * unit, shoulderY + 6 * unit, -58 * unit, shoulderY + 18 * unit, -70 * unit, shoulderY - 12 * unit, unit, bodyFill, rimColor);
      this.drawLimb(ctx, 24 * unit, shoulderY + 6 * unit, 58 * unit, shoulderY + 18 * unit, 72 * unit, shoulderY - 8 * unit, unit, bodyFill, rimColor);
    } else {
      // Cool idle stance: elbows slightly bent, poised above table
      const sway = Math.sin(f.breathPhase * 0.8) * 4 * unit;
      this.drawLimb(ctx, -24 * unit, shoulderY + 6 * unit, -44 * unit, shoulderY + 46 * unit, -26 * unit + sway, shoulderY + 88 * unit, unit, bodyFill, rimColor);
      this.drawLimb(ctx, 24 * unit, shoulderY + 6 * unit, 44 * unit, shoulderY + 46 * unit, 28 * unit - sway, shoulderY + 88 * unit, unit, bodyFill, rimColor);
    }

    // --- Stylized Noir Head + Expressive Glowing Eyes ---
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, headCenterY, headR, 0, Math.PI * 2);
    ctx.fillStyle = bodyFill;
    ctx.fill();
    ctx.lineWidth = 3.2 * unit;
    ctx.strokeStyle = rimColor;
    ctx.stroke();

    // Subtle specular rim arc on top of head from overhead spotlight
    ctx.beginPath();
    ctx.arc(0, headCenterY, headR - 3 * unit, -Math.PI * 0.8, -Math.PI * 0.2);
    ctx.strokeStyle = 'rgba(254, 243, 199, 0.45)';
    ctx.lineWidth = 2.4 * unit;
    ctx.stroke();

    // Stylish noir fedora hat (matches cover.png! Distinct tilt/band color per opponent)
    const hatTilt = f.tieStyle === 'cobalt' ? 0.08 : -0.07;
    ctx.save();
    ctx.translate(0, headCenterY - headR * 0.58);
    ctx.rotate(hatTilt);
    ctx.fillStyle = '#0b0e16';
    ctx.strokeStyle = rimColor;
    ctx.lineWidth = 2.2 * unit;
    // Fedora brim
    ctx.beginPath();
    ctx.ellipse(0, 0, headR * 1.48, headR * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Crown
    ctx.beginPath();
    ctx.moveTo(-headR * 0.85, -2 * unit);
    ctx.lineTo(-headR * 0.62, -headR * 0.92);
    ctx.quadraticCurveTo(0, -headR * 0.72, headR * 0.62, -headR * 0.92);
    ctx.lineTo(headR * 0.85, -2 * unit);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Accent ribbon band
    ctx.fillStyle = f.accentColor;
    ctx.fillRect(-headR * 0.81, -headR * 0.24, headR * 1.62, headR * 0.2);
    ctx.restore();

    // Expressive eyes!
    this.drawEyes(ctx, f, 0, headCenterY, headR, unit);
    ctx.restore();

    // --- Foreground Props (Guns / Riot Shield) ---
    if (f.pose === 'defend' && f.alive) {
      const impactShake = f.shieldImpact > 0 ? Math.sin(f.shieldImpact * 45) * 8 * unit : 0;
      const shW = 138 * unit;
      const shH = 188 * unit;
      ctx.save();
      ctx.translate(impactShake, shoulderY + 34 * unit);
      if (this.isReady(this.shieldEnemyImg)) {
        ctx.drawImage(this.shieldEnemyImg, -shW * 0.5, -shH * 0.5, shW, shH);
      } else {
        // Fallback tactical riot shield
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3 * unit;
        ctx.beginPath();
        ctx.roundRect(-shW * 0.42, -shH * 0.46, shW * 0.84, shH * 0.92, 12 * unit);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = 'rgba(147, 197, 253, 0.35)';
        ctx.fillRect(-shW * 0.28, -shH * 0.28, shW * 0.56, shH * 0.16);
      }
      if (f.shieldImpact > 0.1) {
        ctx.strokeStyle = '#38bdf8';
        ctx.globalAlpha = f.shieldImpact;
        ctx.lineWidth = 4 * unit;
        ctx.strokeRect(-shW * 0.42, -shH * 0.46, shW * 0.84, shH * 0.92);
      }
      ctx.restore();
    } else if ((f.pose === 'aim_player' || f.pose === 'fire_player') && f.alive) {
      // Opponent pointing revolver straight at the player -> dramatic front barrel sprite!
      const gunH = (f.isSuperShot ? 164 : 138) * unit;
      const kick = f.recoil * 20 * unit;
      ctx.save();
      ctx.translate(22 * unit, shoulderY + 24 * unit - kick);
      if (f.isSuperShot) {
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 24;
      }
      if (this.isReady(this.revolverAimedImg)) {
        const aspect = this.revolverAimedImg.naturalWidth / Math.max(1, this.revolverAimedImg.naturalHeight);
        const gunW = gunH * aspect;
        ctx.drawImage(this.revolverAimedImg, -gunW * 0.5, -gunH * 0.5, gunW, gunH);
      } else {
        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.arc(0, 0, 22 * unit, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(0, 0, 10 * unit, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    } else if ((f.pose === 'aim_side' || f.pose === 'fire_side') && f.alive) {
      // Opponent aiming sideways at the other AI in 1v1v1 -> sleek side revolver sprite!
      const gunW = (f.isSuperShot ? 148 : 130) * unit;
      ctx.save();
      ctx.translate(86 * unit * sideDir, shoulderY + 8 * unit - f.recoil * 12 * unit);
      ctx.scale(sideDir, 1);
      if (f.isSuperShot) {
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 22;
      }
      if (this.isReady(this.revolverSideImg)) {
        const aspect = this.revolverSideImg.naturalHeight / Math.max(1, this.revolverSideImg.naturalWidth);
        const gunH = gunW * aspect;
        ctx.drawImage(this.revolverSideImg, -gunW * 0.36, -gunH * 0.5, gunW, gunH);
      }
      ctx.restore();
    } else if (f.pose === 'reload' && f.alive) {
      // Show side revolver spinning slightly during reload!
      const gunW = 112 * unit;
      const spin = (1 - f.reloadAnim) * Math.PI * 0.4 - 0.35;
      ctx.save();
      ctx.translate(8 * unit, shoulderY + 26 * unit);
      ctx.rotate(spin);
      if (this.isReady(this.revolverSideImg)) {
        const aspect = this.revolverSideImg.naturalHeight / Math.max(1, this.revolverSideImg.naturalWidth);
        const gunH = gunW * aspect;
        ctx.drawImage(this.revolverSideImg, -gunW * 0.5, -gunH * 0.5, gunW, gunH);
      }
      ctx.restore();
    }

    // Broken shield warning tag above opponent if disabled this turn
    if (f.alive && f.shieldDisabledThisTurn) {
      ctx.save();
      ctx.font = `800 ${Math.round(13 * unit)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fb7185';
      ctx.strokeStyle = '#090b10';
      ctx.lineWidth = 4;
      const txt = '破盾禁用防御';
      ctx.strokeText(txt, 0, headCenterY - headR - 22 * unit);
      ctx.fillText(txt, 0, headCenterY - headR - 22 * unit);
      ctx.restore();
    }

    ctx.restore();
  }

  private drawLimb(
    ctx: CanvasRenderingContext2D,
    x1: number,
    y1: number,
    mx: number,
    my: number,
    x2: number,
    y2: number,
    unit: number,
    fill: string,
    rim: string
  ): void {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Outer accent rim
    ctx.strokeStyle = rim;
    ctx.lineWidth = 15 * unit;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(mx, my);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Inner noir silhouette limb
    ctx.strokeStyle = fill;
    ctx.lineWidth = 11 * unit;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(mx, my);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  }

  private drawEyes(
    ctx: CanvasRenderingContext2D,
    f: Fighter,
    hx: number,
    hy: number,
    r: number,
    unit: number
  ): void {
    ctx.save();
    const eyeY = hy - 2 * unit;
    const eyeDx = r * 0.36;

    if (!f.alive) {
      // Comic X eyes
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2.6 * unit;
      for (const s of [-1, 1]) {
        const ex = hx + s * eyeDx;
        const sz = 5 * unit;
        ctx.beginPath();
        ctx.moveTo(ex - sz, eyeY - sz);
        ctx.lineTo(ex + sz, eyeY + sz);
        ctx.moveTo(ex + sz, eyeY - sz);
        ctx.lineTo(ex - sz, eyeY + sz);
        ctx.stroke();
      }
      ctx.restore();
      return;
    }

    const eyeColor = f.ammo >= f.maxAmmo ? '#fbbf24' : '#f8fafc';
    ctx.fillStyle = eyeColor;
    ctx.shadowColor = f.ammo >= f.maxAmmo ? '#f59e0b' : f.accentColor;
    ctx.shadowBlur = f.ammo >= f.maxAmmo ? 14 : 6;

    for (const s of [-1, 1]) {
      const ex = hx + s * eyeDx;
      ctx.beginPath();
      if (f.pose === 'hurt') {
        // Wincing > < eyes
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.8 * unit;
        ctx.moveTo(ex - 5 * s * unit, eyeY - 4 * unit);
        ctx.lineTo(ex + 4 * s * unit, eyeY);
        ctx.lineTo(ex - 5 * s * unit, eyeY + 4 * unit);
        ctx.stroke();
      } else if (f.pose === 'aim_player' || f.pose === 'fire_player' || f.ammo >= f.maxAmmo) {
        // Sharp slanted predator anime/comic eyes
        ctx.moveTo(ex - 7 * s * unit, eyeY - 4 * unit);
        ctx.lineTo(ex + 6 * s * unit, eyeY + 1 * unit);
        ctx.lineTo(ex - 5 * s * unit, eyeY + 4 * unit);
        ctx.closePath();
        ctx.fill();
      } else {
        // Sleek narrowed noir eyes
        ctx.ellipse(ex, eyeY, 6 * unit, 3.3 * unit, s * 0.14, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
}
