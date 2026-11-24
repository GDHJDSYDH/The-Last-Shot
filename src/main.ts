import './styles/main.css';
import { soundManager } from './audio/soundManager';
import { ActionType, Fighter, FighterId, GameMode, MatchStats, ResolveEvent, TurnPhase } from './core/types';
import { GameEngine } from './core/gameEngine';
import { CrashGuard } from './crash/crashGuard';
import { OpponentHitbox, SceneRenderer } from './render/sceneRenderer';
import { VfxSystem } from './vfx/vfxSystem';

class LastShotApp {
  private titleScreen = document.getElementById('title-screen') as HTMLElement;
  private battleScreen = document.getElementById('battle-screen') as HTMLElement;
  private rulesModal = document.getElementById('rules-modal') as HTMLElement;

  private sceneCanvas = document.getElementById('scene-canvas') as HTMLCanvasElement;
  private vfxCanvas = document.getElementById('vfx-canvas') as HTMLCanvasElement;
  private sceneCtx = this.sceneCanvas.getContext('2d')!;
  private vfxCtx = this.vfxCanvas.getContext('2d')!;

  private hudTop = document.getElementById('hud-top') as HTMLElement;
  private hudLeft = document.getElementById('hud-slot-left') as HTMLElement;
  private hudCenter = document.getElementById('hud-slot-center') as HTMLElement;
  private hudRight = document.getElementById('hud-slot-right') as HTMLElement;

  private phaseHud = document.getElementById('phase-hud') as HTMLElement;
  private roundPill = document.getElementById('round-pill') as HTMLElement;
  private timerWrap = document.getElementById('timer-wrap') as HTMLElement;
  private timerFill = document.getElementById('timer-bar-fill') as HTMLElement;
  private timerText = document.getElementById('timer-text') as HTMLElement;
  private phaseStatus = document.getElementById('phase-status') as HTMLElement;
  private calloutBanner = document.getElementById('callout-banner') as HTMLElement;

  private actionDock = document.getElementById('action-dock') as HTMLElement;
  private btnReload = document.getElementById('btn-act-reload') as HTMLButtonElement;
  private btnFire = document.getElementById('btn-act-fire') as HTMLButtonElement;
  private btnDefend = document.getElementById('btn-act-defend') as HTMLButtonElement;
  private subReload = document.getElementById('sub-reload') as HTMLElement;
  private iconFire = document.getElementById('icon-fire') as HTMLImageElement;
  private labelFire = document.getElementById('label-fire') as HTMLElement;
  private subFire = document.getElementById('sub-fire') as HTMLElement;
  private subDefend = document.getElementById('sub-defend') as HTMLElement;

  private fpShieldLayer = document.getElementById('fp-shield-layer') as HTMLElement;
  private fpGunLayer = document.getElementById('fp-gun-layer') as HTMLElement;
  private aimOverlay = document.getElementById('aim-overlay') as HTMLElement;
  private aimBanner = document.getElementById('aim-banner') as HTMLElement;
  private aimBannerText = document.getElementById('aim-banner-text') as HTMLElement;
  private aimCountdown = document.getElementById('aim-countdown') as HTMLElement;
  private reticleEl = document.getElementById('reticle') as HTMLElement;

  private resultOverlay = document.getElementById('result-overlay') as HTMLElement;
  private resultKicker = document.getElementById('result-kicker') as HTMLElement;
  private resultTitle = document.getElementById('result-title') as HTMLElement;
  private resultDesc = document.getElementById('result-desc') as HTMLElement;
  private resultStats = document.getElementById('result-stats') as HTMLElement;

  private btnTitleAudio = document.getElementById('btn-title-audio') as HTMLButtonElement;
  private btnBattleAudio = document.getElementById('btn-battle-audio') as HTMLButtonElement;

  private engine: GameEngine;
  private renderer = new SceneRenderer();
  private vfx = new VfxSystem();

  private rafId: number | null = null;
  private loopPaused = false;
  private lastTime = 0;
  private width = window.innerWidth;
  private height = window.innerHeight;
  private currentHitboxes: OpponentHitbox[] = [];

  // Aiming pointer coordinates
  private aimX = window.innerWidth * 0.5;
  private aimY = window.innerHeight * 0.44;
  private hoveredTargetId: FighterId | null = null;
  private calloutTimer = 0;
  private activeMode: GameMode = '1v1';
  private inBattle = false;

  constructor() {
    this.engine = new GameEngine({
      onPhaseChange: (phase, round) => this.handlePhaseChange(phase, round),
      onDecisionLock: (action) => this.handleDecisionLock(action),
      onTickSecond: (sec, phase) => this.handleTickSecond(sec, phase),
      onResolveEvents: (events) => this.handleResolveEvents(events),
      onGameOver: (outcome, stats) => this.handleGameOver(outcome, stats)
    });

    this.installCrashGuard();
    this.bindEvents();
    this.resizeCanvases();
    soundManager.init();
    soundManager.playBgm('title');

    // Expose safe debug hook for verification
    (window as unknown as Record<string, unknown>).__LAST_SHOT_DEBUG__ = {
      getSnapshot: () => this.engine.getSnapshot(),
      triggerTestCrash: () => {
        throw new Error('Simulated diagnostic crash test from __LAST_SHOT_DEBUG__');
      }
    };

    // Optional URL query self-test for Crash Guard (?crashguard-test=1)
    if (new URLSearchParams(window.location.search).get('crashguard-test') === '1') {
      window.setTimeout(() => {
        throw new Error('Crash Guard self-test triggered via ?crashguard-test=1');
      }, 250);
    }
  }

  private installCrashGuard(): void {
    CrashGuard.install({
      getStateSnapshot: () => ({
        inBattle: this.inBattle,
        activeMode: this.activeMode,
        canvasSize: `${this.width}x${this.height}`,
        engine: this.engine.getSnapshot()
      }),
      onPauseLoop: () => {
        this.loopPaused = true;
        if (this.rafId !== null) {
          cancelAnimationFrame(this.rafId);
          this.rafId = null;
        }
      },
      onResume: () => {
        this.loopPaused = false;
        if (this.inBattle) {
          this.lastTime = performance.now();
          this.startLoop();
        }
      },
      onRestart: () => {
        this.loopPaused = false;
        if (this.inBattle) {
          this.startBattle(this.activeMode);
        } else {
          this.returnToTitle();
        }
      }
    });
  }

  private bindEvents(): void {
    window.addEventListener('resize', () => this.resizeCanvases());

    // Title screen mode selection
    document.getElementById('btn-mode-1v1')?.addEventListener('click', () => {
      soundManager.unlockAudio();
      this.startBattle('1v1');
    });
    document.getElementById('btn-mode-1v1v1')?.addEventListener('click', () => {
      soundManager.unlockAudio();
      this.startBattle('1v1v1');
    });

    // Rules modal
    document.getElementById('btn-rules')?.addEventListener('click', () => {
      this.rulesModal.classList.remove('hidden');
    });
    document.getElementById('btn-close-rules')?.addEventListener('click', () => {
      this.rulesModal.classList.add('hidden');
    });
    this.rulesModal.addEventListener('click', (e) => {
      if (e.target === this.rulesModal) this.rulesModal.classList.add('hidden');
    });

    // Audio toggles
    const toggleAudio = () => {
      const muted = soundManager.toggleMute();
      this.btnTitleAudio.textContent = muted ? '🔇 音乐：关' : '🔊 音乐：开';
      this.btnBattleAudio.textContent = muted ? '🔇' : '🔊';
    };
    this.btnTitleAudio.addEventListener('click', toggleAudio);
    this.btnBattleAudio.addEventListener('click', toggleAudio);

    // Return to title & Rematch
    document.getElementById('btn-battle-menu')?.addEventListener('click', () => this.returnToTitle());
    document.getElementById('btn-back-title')?.addEventListener('click', () => this.returnToTitle());
    document.getElementById('btn-rematch')?.addEventListener('click', () => this.startBattle(this.activeMode));

    // Action buttons
    this.btnReload.addEventListener('click', () => this.tryChoose('reload'));
    this.btnFire.addEventListener('click', () => this.tryChoose('fire'));
    this.btnDefend.addEventListener('click', () => this.tryChoose('defend'));

    // PC keyboard shortcuts (1/2/3 or Q/W/E)
    window.addEventListener('keydown', (e) => {
      if (!this.inBattle) return;
      if (this.engine.phase === 'decision') {
        const k = e.key.toLowerCase();
        if (k === '1' || k === 'q') this.tryChoose('reload');
        else if (k === '2' || k === 'w') this.tryChoose('fire');
        else if (k === '3' || k === 'e') this.tryChoose('defend');
      }
    });

    // Aiming pointer interactions (works for both desktop mouse and mobile touch!)
    this.aimOverlay.addEventListener('pointermove', (e) => {
      if (this.engine.phase !== 'aiming') return;
      this.updateAimPosition(e.clientX, e.clientY);
    });

    this.aimOverlay.addEventListener('pointerdown', (e) => {
      if (this.engine.phase !== 'aiming') return;
      e.preventDefault();
      this.updateAimPosition(e.clientX, e.clientY);

      // On mouse (desktop), clicking fires immediately.
      // On touch (mobile), tapping directly on an opponent fires immediately;
      // dragging outside lets the player adjust the reticle and release to fire!
      if (e.pointerType === 'mouse' || this.hoveredTargetId !== null) {
        this.fireAtCurrentAim();
      }
    });

    this.aimOverlay.addEventListener('pointerup', (e) => {
      if (this.engine.phase !== 'aiming') return;
      if (e.pointerType !== 'mouse') {
        this.updateAimPosition(e.clientX, e.clientY);
        this.fireAtCurrentAim();
      }
    });
  }

  private resizeCanvases(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    for (const c of [this.sceneCanvas, this.vfxCanvas]) {
      c.width = Math.floor(this.width * dpr);
      c.height = Math.floor(this.height * dpr);
      const ctx = c.getContext('2d');
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    }
  }

  private startBattle(mode: GameMode): void {
    this.activeMode = mode;
    this.inBattle = true;
    this.loopPaused = false;
    this.vfx.clear();

    this.titleScreen.classList.remove('active');
    this.battleScreen.classList.add('active');
    this.resultOverlay.classList.add('hidden');
    this.hideFirstPersonOverlays();
    this.hideCallout();

    this.hudTop.classList.remove('mode-1v1', 'mode-1v1v1');
    this.hudTop.classList.add(mode === '1v1' ? 'mode-1v1' : 'mode-1v1v1');
    if (mode === '1v1') {
      this.hudCenter.classList.add('hidden');
    } else {
      this.hudCenter.classList.remove('hidden');
    }

    soundManager.playBgm('battle');
    this.resizeCanvases();
    this.engine.startMatch(mode);
    this.renderHud();
    this.updateActionButtons();

    this.lastTime = performance.now();
    this.startLoop();
  }

  private returnToTitle(): void {
    this.inBattle = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.battleScreen.classList.remove('active');
    this.titleScreen.classList.add('active');
    this.resultOverlay.classList.add('hidden');
    this.hideFirstPersonOverlays();
    soundManager.playBgm('title');
  }

  private startLoop(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    const tick = (now: number) => {
      if (this.loopPaused || !this.inBattle) return;
      try {
        const rawDt = (now - this.lastTime) / 1000;
        this.lastTime = now;
        const dt = Math.min(0.05, Math.max(0.001, rawDt));

        this.update(dt);
        this.renderFrame(dt);
        this.rafId = requestAnimationFrame(tick);
      } catch (err) {
        CrashGuard.report(err, 'mainLoop.requestAnimationFrame');
      }
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private update(dt: number): void {
    this.vfx.update(dt);
    if (this.vfx.hitstopTimer > 0) return;

    this.engine.update(dt);

    if (this.calloutTimer > 0) {
      this.calloutTimer -= dt;
      if (this.calloutTimer <= 0) {
        this.hideCallout();
      }
    }

    // Update countdown UI smoothly
    if (this.engine.phase === 'decision') {
      const pct = Math.max(0, Math.min(1, this.engine.phaseTimer / this.engine.phaseDuration));
      this.timerFill.style.width = `${pct * 100}%`;
      this.timerFill.classList.toggle('urgent', this.engine.phaseTimer <= 1.0);
      this.timerText.textContent = `${Math.max(0, this.engine.phaseTimer).toFixed(1)}s`;
    } else if (this.engine.phase === 'aiming') {
      this.aimCountdown.textContent = `${Math.max(0, this.engine.phaseTimer).toFixed(1)}s`;
      // Subtle organic reticle sway for psychological tension
      const swayX = Math.sin(performance.now() * 0.0065) * 4;
      const swayY = Math.cos(performance.now() * 0.0052) * 3;
      this.reticleEl.style.left = `${this.aimX + swayX}px`;
      this.reticleEl.style.top = `${this.aimY + swayY}px`;
      this.updateHoveredTarget(this.aimX, this.aimY);
    }
  }

  private renderFrame(dt: number): void {
    const opponents = this.engine.getOpponents();
    const shake = this.vfx.getShakeOffset();
    this.currentHitboxes = this.renderer.render(
      this.sceneCtx,
      this.width,
      this.height,
      opponents,
      this.engine.phase,
      this.hoveredTargetId,
      shake,
      dt
    );
    this.vfx.render(this.vfxCtx, this.width, this.height);
  }

  private tryChoose(action: ActionType): void {
    if (this.engine.selectPlayerAction(action)) {
      soundManager.playLock();
      this.updateActionButtons();
    }
  }

  private handleDecisionLock(action: ActionType): void {
    const names: Record<ActionType, string> = {
      reload: '已锁定：装子弹（等待揭晓）',
      fire: this.engine.getPlayer().isSuperShot ? '已锁定：超级射击！（准备瞄准）' : '已锁定：开火（准备瞄准）',
      defend: '已锁定：防暴盾防御（等待揭晓）',
      none: ''
    };
    this.phaseStatus.textContent = names[action];
  }

  private handleTickSecond(sec: number, phase: TurnPhase): void {
    soundManager.playTick(sec === 1 || phase === 'aiming');
  }

  private handlePhaseChange(phase: TurnPhase, round: number): void {
    this.roundPill.textContent = `ROUND ${round}`;
    this.renderHud();

    if (phase === 'decision') {
      this.hideFirstPersonOverlays();
      this.phaseHud.classList.remove('hidden');
      this.timerWrap.classList.remove('hidden');
      this.actionDock.classList.remove('hidden');
      this.phaseStatus.textContent = '3 秒内决策，选定后不可反悔！';
      this.updateActionButtons();
    } else if (phase === 'reveal') {
      this.timerWrap.classList.add('hidden');
      this.actionDock.classList.add('hidden');
      const player = this.engine.getPlayer();

      if (player.chosenAction === 'defend') {
        this.showPlayerShield();
        soundManager.playShieldUp();
        this.phaseStatus.textContent = '防暴盾已举起！透过观察口紧盯对手...';
      } else if (player.chosenAction === 'fire') {
        this.showPlayerGun(player.isSuperShot);
        this.phaseStatus.textContent = player.isSuperShot ? '超级射击拔枪！准备瞄准！' : '拔枪！准备瞄准对手！';
      } else if (player.chosenAction === 'reload') {
        this.phaseStatus.textContent = '装填子弹中...';
      } else {
        this.phaseStatus.textContent = '未做出决策（空过）...';
      }
    } else if (phase === 'aiming') {
      const player = this.engine.getPlayer();
      this.phaseHud.classList.add('hidden');
      this.actionDock.classList.add('hidden');
      this.aimOverlay.classList.remove('hidden');
      this.showPlayerGun(player.isSuperShot);

      this.aimBanner.classList.toggle('super', player.isSuperShot);
      this.aimBannerText.textContent = player.isSuperShot
        ? '★ 超级射击！3秒内瞄准对手破盾暴击！'
        : '瞄准对手并点击开火！';

      // Center reticle initially
      this.aimX = this.width * 0.5;
      this.aimY = this.height * 0.45;
      this.updateAimPosition(this.aimX, this.aimY);
    } else if (phase === 'resolve') {
      this.aimOverlay.classList.add('hidden');
      this.phaseHud.classList.remove('hidden');
      this.timerWrap.classList.add('hidden');
      this.actionDock.classList.add('hidden');
      this.phaseStatus.textContent = '回合结算中...';
      this.renderHud();
    } else if (phase === 'gameover') {
      this.aimOverlay.classList.add('hidden');
      this.actionDock.classList.add('hidden');
      this.renderHud();
    }
  }

  private handleResolveEvents(events: ResolveEvent[]): void {
    const playerOriginX = this.width * 0.5;
    const playerOriginY = this.height * 0.78;
    const playerHitX = this.width * 0.5;
    const playerHitY = this.height * 0.55;

    const getPos = (id: FighterId): { x: number; y: number; muzzleX: number; muzzleY: number } => {
      if (id === 'player') {
        return { x: playerHitX, y: playerHitY, muzzleX: playerOriginX, muzzleY: playerOriginY };
      }
      const hb = this.currentHitboxes.find((h) => h.fighterId === id);
      if (hb) {
        return { x: hb.centerX, y: hb.centerY, muzzleX: hb.muzzleX, muzzleY: hb.muzzleY };
      }
      return { x: this.width * 0.5, y: this.height * 0.45, muzzleX: this.width * 0.5, muzzleY: this.height * 0.45 };
    };

    const bannerMessages: string[] = [];

    for (const ev of events) {
      const actorPos = getPos(ev.actorId);
      const targetPos = ev.targetId ? getPos(ev.targetId) : null;

      if (ev.type === 'reload') {
        soundManager.playReload();
        const actor = this.engine.getFighter(ev.actorId);
        const isFull = Boolean(actor && actor.ammo >= actor.maxAmmo);
        if (ev.actorId === 'player') {
          this.vfx.spawnReloadGlint(this.width * 0.5, this.height * 0.72, isFull);
          this.vfx.spawnFloatingText(
            this.width * 0.5,
            this.height * 0.68,
            isFull ? 'SUPER READY!' : '+1 AMMO',
            isFull ? '#fbbf24' : '#fde047',
            isFull ? 1.25 : 0.95,
            isFull ? '6发蓄满 · 超级射击就绪' : undefined
          );
        } else {
          this.vfx.spawnReloadGlint(actorPos.x, actorPos.y - 20, isFull);
          if (isFull) {
            this.vfx.spawnFloatingText(actorPos.x, actorPos.y - 80, '警告：满弹！', '#fbbf24', 1.05);
          }
        }
      } else if (ev.type === 'forfeit') {
        soundManager.playForfeit();
        this.vfx.spawnFloatingText(this.width * 0.5, this.height * 0.48, '超时弃权！', '#94a3b8', 1.15);
        bannerMessages.push(ev.message);
      } else if (ev.type === 'shot_miss') {
        soundManager.playGunshot(Boolean(ev.isSuper));
        this.triggerPlayerGunRecoil();
        this.vfx.spawnMuzzleFlash(playerOriginX, playerOriginY - 60, Boolean(ev.isSuper));
        this.vfx.spawnBulletTracer(playerOriginX, playerOriginY - 60, this.aimX, this.aimY, Boolean(ev.isSuper));
        this.vfx.addShake(ev.isSuper ? 14 : 6, 0.22);
        this.vfx.spawnFloatingText(this.aimX, this.aimY, 'MISS!', '#cbd5e1', 1.1);
        bannerMessages.push(ev.message);
      } else if (ev.type === 'shot_hit' && targetPos) {
        soundManager.playGunshot(Boolean(ev.isSuper));
        if (ev.actorId === 'player') this.triggerPlayerGunRecoil();

        const tx = ev.actorId === 'player' ? this.aimX : targetPos.x;
        const ty = ev.actorId === 'player' ? this.aimY : targetPos.y;
        this.vfx.spawnMuzzleFlash(actorPos.muzzleX, actorPos.muzzleY, Boolean(ev.isSuper));
        this.vfx.spawnBulletTracer(actorPos.muzzleX, actorPos.muzzleY, tx, ty, Boolean(ev.isSuper));
        this.vfx.spawnHitSparks(tx, ty, Boolean(ev.isSuper));

        if (ev.isSuper) {
          this.vfx.addHitstop(0.075);
          this.vfx.addShake(22, 0.42);
          this.vfx.addScreenFlash('#fbbf24', 0.42);
        } else {
          this.vfx.addShake(11, 0.24);
          if (ev.targetId === 'player') this.vfx.addScreenFlash('#e11d48', 0.45);
        }

        const dmg = ev.damage || 1;
        this.vfx.spawnFloatingText(
          ev.targetId === 'player' ? this.width * 0.5 : targetPos.x,
          ev.targetId === 'player' ? this.height * 0.52 : targetPos.y - 50,
          ev.isSuper ? `CRIT -${dmg}♥!` : `-${dmg}♥`,
          ev.isSuper ? '#fde047' : '#fb7185',
          ev.isSuper ? 1.35 : 1.1,
          ev.isSuper ? '超级射击暴击 · 破盾1回合' : undefined
        );
        bannerMessages.push(ev.message);
      } else if (ev.type === 'shot_blocked' && targetPos) {
        soundManager.playGunshot(false);
        soundManager.playShieldBlock();
        if (ev.actorId === 'player') this.triggerPlayerGunRecoil();

        this.vfx.spawnMuzzleFlash(actorPos.muzzleX, actorPos.muzzleY, false);
        this.vfx.spawnBulletTracer(actorPos.muzzleX, actorPos.muzzleY, targetPos.x, targetPos.y, false);
        this.vfx.spawnShieldBlock(targetPos.x, targetPos.y);
        this.vfx.addShake(9, 0.2);

        if (ev.targetId === 'player') {
          this.vfx.addScreenFlash('#38bdf8', 0.28);
          this.fpShieldLayer.classList.remove('impact');
          void this.fpShieldLayer.offsetWidth;
          this.fpShieldLayer.classList.add('impact', 'cracked');
        }

        this.vfx.spawnFloatingText(
          ev.targetId === 'player' ? this.width * 0.5 : targetPos.x,
          ev.targetId === 'player' ? this.height * 0.42 : targetPos.y - 50,
          'BLOCKED!',
          '#38bdf8',
          1.15,
          '防暴盾格挡成功'
        );
        bannerMessages.push(ev.message);
      } else if (ev.type === 'super_shatter' && targetPos) {
        soundManager.playGunshot(true);
        soundManager.playShieldShatter();
        if (ev.actorId === 'player') this.triggerPlayerGunRecoil();

        this.vfx.spawnMuzzleFlash(actorPos.muzzleX, actorPos.muzzleY, true);
        this.vfx.spawnBulletTracer(actorPos.muzzleX, actorPos.muzzleY, targetPos.x, targetPos.y, true);
        this.vfx.spawnShieldShatter(targetPos.x, targetPos.y);
        this.vfx.addHitstop(0.09);
        this.vfx.addShake(28, 0.52);
        this.vfx.addScreenFlash('#f43f5e', 0.52);

        if (ev.targetId === 'player') {
          this.fpShieldLayer.classList.add('shattered');
        }

        this.vfx.spawnFloatingText(
          ev.targetId === 'player' ? this.width * 0.5 : targetPos.x,
          ev.targetId === 'player' ? this.height * 0.46 : targetPos.y - 55,
          `破盾暴击 -${ev.damage || 2}♥!`,
          '#fde047',
          1.4,
          '盾牌损毁 · 下一回合禁用防御'
        );
        bannerMessages.push(ev.message);
      } else if (ev.type === 'super_suppress' || ev.type === 'shot_clash') {
        soundManager.playGunshot(true);
        this.vfx.addShake(18, 0.35);
        this.vfx.addScreenFlash('#fbbf24', 0.35);
        bannerMessages.push(ev.message);
      } else if (ev.type === 'eliminated') {
        bannerMessages.push(ev.message);
      }
    }

    if (bannerMessages.length > 0) {
      this.showCallout(bannerMessages.slice(0, 2).join(' · '), 1.55);
    }

    this.renderHud();
  }

  private handleGameOver(outcome: 'victory' | 'defeat' | 'draw', stats: MatchStats): void {
    soundManager.playGameOver(outcome === 'victory');
    this.hideFirstPersonOverlays();

    this.resultTitle.className = `result-title ${outcome}`;
    if (outcome === 'victory') {
      this.resultKicker.textContent = 'LAST ONE STANDING';
      this.resultTitle.textContent = '决斗胜利';
      this.resultDesc.textContent =
        this.activeMode === '1v1v1'
          ? '你在三人混战的心理博弈中笑到了最后！'
          : '精准的读心与果断的扳机，你赢得了这场终局对决！';
    } else if (outcome === 'defeat') {
      this.resultKicker.textContent = 'ELIMINATED';
      this.resultTitle.textContent = '遗憾落败';
      this.resultDesc.textContent = '对手看穿了你的节奏，重整旗鼓再来一局！';
    } else {
      this.resultKicker.textContent = 'MUTUAL ANNIHILATION';
      this.resultTitle.textContent = '同归于尽';
      this.resultDesc.textContent = '双方在最后一发子弹中同时倒下！';
    }

    const accuracy = stats.shotsFired > 0 ? `${Math.round((stats.shotsHit / stats.shotsFired) * 100)}%` : '—';
    this.resultStats.innerHTML = `
      <div class="stat-box"><div class="stat-val">${stats.roundsPlayed}</div><div class="stat-lbl">总回合数</div></div>
      <div class="stat-box"><div class="stat-val">${accuracy}</div><div class="stat-lbl">射击命中率 (${stats.shotsHit}/${stats.shotsFired})</div></div>
      <div class="stat-box"><div class="stat-val">${stats.superShotsFired}</div><div class="stat-lbl">超级射击次数</div></div>
      <div class="stat-box"><div class="stat-val">${stats.attacksBlocked}</div><div class="stat-lbl">成功格挡次数</div></div>
    `;

    this.resultOverlay.classList.remove('hidden');
  }

  private updateAimPosition(clientX: number, clientY: number): void {
    this.aimX = clientX;
    this.aimY = clientY;
    this.reticleEl.style.left = `${clientX}px`;
    this.reticleEl.style.top = `${clientY}px`;

    // Subtle parallax tilt of centered floating first-person revolver toward aim point
    const nx = (clientX / Math.max(1, this.width) - 0.5) * 2;
    const ny = (clientY / Math.max(1, this.height) - 0.5) * 2;
    this.fpGunLayer.style.transform = `translateX(calc(-50% + ${nx * 26}px)) translateY(${ny * 14}px) rotate(${nx * 8}deg)`;

    this.updateHoveredTarget(clientX, clientY);
  }

  private updateHoveredTarget(x: number, y: number): void {
    let found: FighterId | null = null;
    for (const hb of this.currentHitboxes) {
      const f = this.engine.getFighter(hb.fighterId);
      if (!f || !f.alive) continue;
      // Generous touch/click hitbox padding
      const pad = 16;
      if (x >= hb.x - pad && x <= hb.x + hb.w + pad && y >= hb.y - pad && y <= hb.y + hb.h + pad) {
        found = hb.fighterId;
        break;
      }
    }
    this.hoveredTargetId = found;
    this.reticleEl.classList.toggle('locked', found !== null);
  }

  private fireAtCurrentAim(): void {
    this.updateHoveredTarget(this.aimX, this.aimY);
    this.engine.submitPlayerShot(this.hoveredTargetId);
  }

  private showPlayerShield(): void {
    this.fpGunLayer.classList.add('hidden');
    this.fpShieldLayer.classList.remove('hidden', 'cracked', 'impact', 'shattered');
  }

  private showPlayerGun(isSuper: boolean): void {
    this.fpShieldLayer.classList.add('hidden');
    this.fpGunLayer.classList.remove('hidden', 'recoil');
    this.fpGunLayer.classList.toggle('super-charged', isSuper);
    this.fpGunLayer.style.transform = 'translateX(-50%)';
  }

  private triggerPlayerGunRecoil(): void {
    this.fpGunLayer.classList.remove('recoil');
    void this.fpGunLayer.offsetWidth;
    this.fpGunLayer.classList.add('recoil');
  }

  private hideFirstPersonOverlays(): void {
    this.fpShieldLayer.classList.add('hidden');
    this.fpShieldLayer.classList.remove('cracked', 'impact', 'shattered');
    this.fpGunLayer.classList.add('hidden');
    this.fpGunLayer.classList.remove('super-charged', 'recoil');
    this.aimOverlay.classList.add('hidden');
  }

  private showCallout(text: string, duration = 1.4): void {
    this.calloutBanner.textContent = text;
    this.calloutBanner.classList.remove('hidden');
    this.calloutTimer = duration;
  }

  private hideCallout(): void {
    this.calloutBanner.classList.add('hidden');
    this.calloutTimer = 0;
  }

  private updateActionButtons(): void {
    const p = this.engine.getPlayer();
    const locked = p.chosenAction !== 'none';
    const isDecision = this.engine.phase === 'decision';
    const isSuper = p.ammo >= p.maxAmmo;

    // Reload button
    const canReload = this.engine.canPlayerChoose('reload');
    this.btnReload.disabled = !canReload;
    this.btnReload.classList.toggle('locked-selected', locked && p.chosenAction === 'reload');
    this.btnReload.classList.toggle('locked-grey', locked && p.chosenAction !== 'reload');
    this.subReload.textContent = p.ammo >= p.maxAmmo ? '弹巢已满 (6/6)' : `装弹 (${p.ammo}/6 → ${p.ammo + 1})`;

    // Fire / Super Shot button
    const canFire = this.engine.canPlayerChoose('fire');
    this.btnFire.disabled = !canFire;
    this.btnFire.classList.toggle('super-mode', isSuper && (!locked || p.chosenAction === 'fire'));
    this.btnFire.classList.toggle('locked-selected', locked && p.chosenAction === 'fire');
    this.btnFire.classList.toggle('locked-grey', locked && p.chosenAction !== 'fire');
    this.iconFire.src = isSuper ? './assets/images/ui_super_shot.png' : './assets/images/revolver_ui_btn.png';
    this.labelFire.textContent = isSuper ? '超级射击!' : '开火';
    this.subFire.textContent = isSuper
      ? '暴击2伤 · 破盾清弹'
      : p.ammo > 0
        ? `消耗1弹 · 伤害1 (${p.ammo}/6)`
        : '无子弹不可开火';

    // Defend button
    const canDefend = this.engine.canPlayerChoose('defend');
    this.btnDefend.disabled = !canDefend;
    this.btnDefend.classList.toggle('locked-selected', locked && p.chosenAction === 'defend');
    this.btnDefend.classList.toggle('locked-grey', locked && p.chosenAction !== 'defend');
    this.subDefend.textContent = p.shieldDisabledThisTurn
      ? '盾牌损毁！本回合禁用'
      : '防暴盾格挡普通弹';

    if (!isDecision) {
      this.btnReload.disabled = true;
      this.btnFire.disabled = true;
      this.btnDefend.disabled = true;
    }
  }

  private renderHud(): void {
    const player = this.engine.getPlayer();
    const opponents = this.engine.getOpponents();

    if (this.activeMode === '1v1') {
      // 1v1: Player Top-Left, Opponent Top-Right
      this.fillHudCard(this.hudLeft, player);
      this.fillHudCard(this.hudRight, opponents[0]);
    } else {
      // 1v1v1: AI-Left Top-Left, Player Top-Center, AI-Right Top-Right
      const leftAi = opponents.find((o) => o.id === 'ai_left') || opponents[0];
      const rightAi = opponents.find((o) => o.id === 'ai_right') || opponents[1];
      this.fillHudCard(this.hudLeft, leftAi);
      this.fillHudCard(this.hudCenter, player);
      this.fillHudCard(this.hudRight, rightAi);
    }
  }

  private fillHudCard(el: HTMLElement, f: Fighter): void {
    el.className = 'hud-card';
    if (f.isPlayer) el.classList.add('is-player');
    if (f.ammo >= f.maxAmmo && f.alive) el.classList.add('super-ready');
    if (!f.alive) el.classList.add('eliminated');

    let badgeHtml = '';
    if (!f.alive) {
      badgeHtml = '<span class="hud-shield-status hud-shield-broken">已淘汰</span>';
    } else if (f.shieldDisabledThisTurn) {
      badgeHtml = '<span class="hud-shield-status hud-shield-broken">破盾禁防</span>';
    } else if (f.ammo >= f.maxAmmo) {
      badgeHtml = '<span class="hud-shield-status hud-shield-super">SUPER 6/6</span>';
    }

    let heartsHtml = '';
    for (let i = 0; i < f.maxHp; i++) {
      heartsHtml += `<span class="heart-pip ${i < f.hp ? '' : 'empty'}"><img src="./assets/images/ui_heart.png" alt="♥" /></span>`;
    }

    let ammoHtml = '';
    const superFull = f.ammo >= f.maxAmmo;
    for (let i = 0; i < f.maxAmmo; i++) {
      const cls = i < f.ammo ? (superFull ? 'ammo-pip super' : 'ammo-pip filled') : 'ammo-pip';
      ammoHtml += `<span class="${cls}"></span>`;
    }

    el.innerHTML = `
      <div class="hud-header">
        <div class="hud-name-wrap">
          <span class="hud-tag ${f.isPlayer ? 'hud-tag-player' : 'hud-tag-ai'}">${f.isPlayer ? '玩家' : 'AI'}</span>
          <span class="hud-name" style="color:${f.isPlayer ? '#fde047' : f.accentColor}">${f.name}</span>
        </div>
        ${badgeHtml}
      </div>
      <div class="hud-row">
        <div class="hearts-row" aria-label="血量 ${f.hp}/${f.maxHp}">${heartsHtml}</div>
        <span class="hud-num">${f.hp}/${f.maxHp}</span>
      </div>
      <div class="hud-row">
        <div class="ammo-row" aria-label="子弹 ${f.ammo}/${f.maxAmmo}">${ammoHtml}</div>
        <span class="hud-num">${f.ammo}/${f.maxAmmo}</span>
      </div>
    `;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  try {
    new LastShotApp();
  } catch (err) {
    CrashGuard.report(err, 'bootstrap');
  }
});
