import { decideAIAction } from '../ai/tacticalAI';
import {
  ActionType,
  Fighter,
  FighterId,
  GameMode,
  GameSnapshot,
  MatchStats,
  ResolveEvent,
  TurnPhase
} from './types';

export const DECISION_DURATION = 3.0;
export const REVEAL_DURATION = 0.65;
export const AIM_DURATION = 3.0;
export const RESOLVE_DURATION = 1.65;

export interface EngineCallbacks {
  onPhaseChange: (phase: TurnPhase, round: number) => void;
  onDecisionLock: (action: ActionType) => void;
  onTickSecond: (secondsLeft: number, phase: TurnPhase) => void;
  onResolveEvents: (events: ResolveEvent[]) => void;
  onGameOver: (outcome: 'victory' | 'defeat' | 'draw', stats: MatchStats) => void;
}

export class GameEngine {
  public mode: GameMode = '1v1';
  public phase: TurnPhase = 'idle';
  public round = 0;
  public phaseTimer = 0;
  public phaseDuration = 0;
  public fighters: Fighter[] = [];
  public playerHistory: ActionType[] = [];
  public stats: MatchStats = this.createEmptyStats();

  private lastWholeSecond = -1;
  private callbacks: EngineCallbacks;

  constructor(callbacks: EngineCallbacks) {
    this.callbacks = callbacks;
  }

  private createEmptyStats(): MatchStats {
    return {
      roundsPlayed: 0,
      shotsFired: 0,
      shotsHit: 0,
      superShotsFired: 0,
      attacksBlocked: 0,
      aimForfeits: 0
    };
  }

  public startMatch(mode: GameMode): void {
    this.mode = mode;
    this.round = 0;
    this.playerHistory = [];
    this.stats = this.createEmptyStats();

    const player: Fighter = {
      id: 'player',
      name: '玩家 YOU',
      subtitle: '第一人称',
      isPlayer: true,
      hp: 5,
      maxHp: 5,
      ammo: 0,
      maxAmmo: 6,
      alive: true,
      shieldDisabledThisTurn: false,
      shieldDisabledNextTurn: false,
      chosenAction: 'none',
      isSuperShot: false,
      targetId: null,
      forfeitedAim: false,
      missedShot: false,
      accentColor: '#f59e0b',
      tieStyle: 'gold',
      slotX: 0.5,
      pose: 'idle',
      hitFlash: 0,
      recoil: 0,
      shieldImpact: 0,
      shieldShatterAnim: 0,
      reloadAnim: 0,
      deathAnim: 0,
      breathPhase: 0
    };

    if (mode === '1v1') {
      const opponent: Fighter = {
        id: 'ai_right',
        name: '黑桃死神',
        subtitle: 'AI 对手',
        isPlayer: false,
        hp: 5,
        maxHp: 5,
        ammo: 0,
        maxAmmo: 6,
        alive: true,
        shieldDisabledThisTurn: false,
        shieldDisabledNextTurn: false,
        chosenAction: 'none',
        isSuperShot: false,
        targetId: null,
        forfeitedAim: false,
        missedShot: false,
        accentColor: '#e11d48',
        tieStyle: 'crimson',
        slotX: 0.5,
        pose: 'idle',
        hitFlash: 0,
        recoil: 0,
        shieldImpact: 0,
        shieldShatterAnim: 0,
        reloadAnim: 0,
        deathAnim: 0,
        breathPhase: 0.4
      };
      this.fighters = [player, opponent];
    } else {
      const aiLeft: Fighter = {
        id: 'ai_left',
        name: '绯红老千',
        subtitle: 'AI 左侧',
        isPlayer: false,
        hp: 5,
        maxHp: 5,
        ammo: 0,
        maxAmmo: 6,
        alive: true,
        shieldDisabledThisTurn: false,
        shieldDisabledNextTurn: false,
        chosenAction: 'none',
        isSuperShot: false,
        targetId: null,
        forfeitedAim: false,
        missedShot: false,
        accentColor: '#e11d48',
        tieStyle: 'crimson',
        slotX: 0.3,
        pose: 'idle',
        hitFlash: 0,
        recoil: 0,
        shieldImpact: 0,
        shieldShatterAnim: 0,
        reloadAnim: 0,
        deathAnim: 0,
        breathPhase: 0.3
      };
      const aiRight: Fighter = {
        id: 'ai_right',
        name: '钴蓝枪手',
        subtitle: 'AI 右侧',
        isPlayer: false,
        hp: 5,
        maxHp: 5,
        ammo: 0,
        maxAmmo: 6,
        alive: true,
        shieldDisabledThisTurn: false,
        shieldDisabledNextTurn: false,
        chosenAction: 'none',
        isSuperShot: false,
        targetId: null,
        forfeitedAim: false,
        missedShot: false,
        accentColor: '#38bdf8',
        tieStyle: 'cobalt',
        slotX: 0.7,
        pose: 'idle',
        hitFlash: 0,
        recoil: 0,
        shieldImpact: 0,
        shieldShatterAnim: 0,
        reloadAnim: 0,
        deathAnim: 0,
        breathPhase: 1.9
      };
      this.fighters = [player, aiLeft, aiRight];
    }

    this.beginNextRound();
  }

  public getPlayer(): Fighter {
    const p = this.fighters.find((f) => f.isPlayer);
    if (!p) throw new Error('Player fighter not initialized');
    return p;
  }

  public getOpponents(): Fighter[] {
    return this.fighters.filter((f) => !f.isPlayer);
  }

  public getFighter(id: FighterId | null): Fighter | undefined {
    if (!id) return undefined;
    return this.fighters.find((f) => f.id === id);
  }

  public canPlayerChoose(action: ActionType): boolean {
    if (this.phase !== 'decision') return false;
    const p = this.getPlayer();
    if (!p.alive || p.chosenAction !== 'none') return false;
    if (action === 'fire') return p.ammo > 0;
    if (action === 'defend') return !p.shieldDisabledThisTurn;
    if (action === 'reload') return p.ammo < p.maxAmmo;
    return false;
  }

  public selectPlayerAction(action: ActionType): boolean {
    if (!this.canPlayerChoose(action)) return false;
    const p = this.getPlayer();
    p.chosenAction = action;
    p.isSuperShot = action === 'fire' && p.ammo >= p.maxAmmo;
    this.callbacks.onDecisionLock(action);
    return true;
  }

  /**
   * Called during the 3-second aiming phase when player clicks/taps to fire.
   * targetId is null if the player missed all alive opponent hitboxes.
   */
  public submitPlayerShot(targetId: FighterId | null): boolean {
    if (this.phase !== 'aiming') return false;
    const p = this.getPlayer();
    if (!p.alive || p.chosenAction !== 'fire') return false;

    if (targetId) {
      const target = this.getFighter(targetId);
      if (target && target.alive && !target.isPlayer) {
        p.targetId = targetId;
        p.missedShot = false;
      } else {
        p.targetId = null;
        p.missedShot = true;
      }
    } else {
      p.targetId = null;
      p.missedShot = true;
    }
    p.forfeitedAim = false;
    this.enterResolvePhase();
    return true;
  }

  public update(dt: number): void {
    // Advance visual decay timers on all fighters
    for (const f of this.fighters) {
      f.breathPhase += dt * (f.ammo >= 5 ? 4.2 : 2.3);
      if (f.hitFlash > 0) f.hitFlash = Math.max(0, f.hitFlash - dt * 2.8);
      if (f.recoil > 0) f.recoil = Math.max(0, f.recoil - dt * 4.5);
      if (f.shieldImpact > 0) f.shieldImpact = Math.max(0, f.shieldImpact - dt * 2.5);
      if (f.shieldShatterAnim > 0) f.shieldShatterAnim = Math.max(0, f.shieldShatterAnim - dt * 1.4);
      if (f.reloadAnim > 0) f.reloadAnim = Math.max(0, f.reloadAnim - dt * 1.6);
      if (!f.alive && f.deathAnim < 1) {
        f.deathAnim = Math.min(1, f.deathAnim + dt * 2.2);
      }
    }

    if (this.phase === 'idle' || this.phase === 'gameover') return;

    this.phaseTimer -= dt;

    // Emit crisp 1-second tick notifications during decision & aiming
    if (this.phase === 'decision' || this.phase === 'aiming') {
      const sec = Math.ceil(Math.max(0, this.phaseTimer));
      if (sec !== this.lastWholeSecond && sec > 0) {
        this.lastWholeSecond = sec;
        this.callbacks.onTickSecond(sec, this.phase);
      }
    }

    if (this.phaseTimer <= 0) {
      if (this.phase === 'decision') {
        this.enterRevealPhase();
      } else if (this.phase === 'reveal') {
        const p = this.getPlayer();
        if (p.alive && p.chosenAction === 'fire') {
          this.enterAimingPhase();
        } else {
          this.enterResolvePhase();
        }
      } else if (this.phase === 'aiming') {
        // 3 seconds expired -> forfeit shot!
        const p = this.getPlayer();
        p.forfeitedAim = true;
        p.targetId = null;
        p.missedShot = false;
        this.stats.aimForfeits += 1;
        this.enterResolvePhase();
      } else if (this.phase === 'resolve') {
        this.finishTurnAndCheckWinner();
      }
    }
  }

  private beginNextRound(): void {
    this.round += 1;
    this.stats.roundsPlayed = this.round;

    for (const f of this.fighters) {
      f.shieldDisabledThisTurn = f.shieldDisabledNextTurn;
      f.shieldDisabledNextTurn = false;
      f.chosenAction = 'none';
      f.isSuperShot = false;
      f.targetId = null;
      f.forfeitedAim = false;
      f.missedShot = false;
      f.pose = f.alive ? 'idle' : 'dead';
    }

    this.setPhase('decision', DECISION_DURATION);
  }

  private enterRevealPhase(): void {
    // AI locks in its tactical decisions now (blind simultaneous reveal!)
    for (const f of this.fighters) {
      if (!f.isPlayer && f.alive) {
        const dec = decideAIAction(f, this.fighters, this.playerHistory, this.round);
        f.chosenAction = dec.action;
        f.targetId = dec.targetId;
        f.isSuperShot = dec.action === 'fire' && f.ammo >= f.maxAmmo;
      }
    }

    // Record player's choice into mind-game history
    const player = this.getPlayer();
    this.playerHistory.push(player.chosenAction);
    if (this.playerHistory.length > 10) {
      this.playerHistory.shift();
    }

    // Set dramatic reveal poses for AI fighters
    for (const f of this.fighters) {
      if (!f.alive) {
        f.pose = 'dead';
        continue;
      }
      if (!f.isPlayer) {
        if (f.chosenAction === 'reload') {
          f.pose = 'reload';
          f.reloadAnim = 1;
        } else if (f.chosenAction === 'defend') {
          f.pose = 'defend';
        } else if (f.chosenAction === 'fire') {
          f.pose = f.targetId === 'player' ? 'aim_player' : 'aim_side';
        } else {
          f.pose = 'idle';
        }
      }
    }

    this.setPhase('reveal', REVEAL_DURATION);
  }

  private enterAimingPhase(): void {
    this.setPhase('aiming', AIM_DURATION);
  }

  private enterResolvePhase(): void {
    const events: ResolveEvent[] = [];

    // 1. Handle forfeits & reloads first
    for (const f of this.fighters) {
      if (!f.alive) continue;
      if (f.chosenAction === 'reload' && f.ammo < f.maxAmmo) {
        f.ammo = Math.min(f.maxAmmo, f.ammo + 1);
        f.reloadAnim = 1;
        events.push({
          type: 'reload',
          actorId: f.id,
          message: f.ammo >= f.maxAmmo
            ? `${f.name} 装弹至 6 发 —— 超级射击就绪！`
            : `${f.name} 装填 1 发子弹 (${f.ammo}/6)`
        });
      }
      if (f.isPlayer && f.chosenAction === 'fire' && f.forfeitedAim) {
        events.push({
          type: 'forfeit',
          actorId: f.id,
          message: '瞄准超时！本回合视为弃权'
        });
      }
    }

    // 2. Collect all actual shots fired this turn
    interface ActiveShot {
      shooter: Fighter;
      target: Fighter | null;
      isSuper: boolean;
      cancelled: boolean;
      clashReduced: boolean;
    }

    const shots: ActiveShot[] = [];
    for (const f of this.fighters) {
      if (!f.alive) continue;
      if (f.chosenAction !== 'fire') continue;
      if (f.forfeitedAim) continue;
      if (f.ammo <= 0) continue;

      const isSuper = f.isSuperShot && f.ammo >= f.maxAmmo;
      // Consume ammo
      f.ammo = isSuper ? 0 : Math.max(0, f.ammo - 1);
      f.recoil = 1;

      if (f.isPlayer) {
        this.stats.shotsFired += 1;
        if (isSuper) this.stats.superShotsFired += 1;
      } else {
        f.pose = f.targetId === 'player' ? 'fire_player' : 'fire_side';
      }

      if (f.missedShot || !f.targetId) {
        events.push({
          type: 'shot_miss',
          actorId: f.id,
          isSuper,
          message: isSuper ? '超级射击打偏了！弹巢归零！' : '子弹打偏，击空！'
        });
        continue;
      }

      const target = this.getFighter(f.targetId) || null;
      if (!target || !target.alive) continue;

      shots.push({
        shooter: f,
        target,
        isSuper,
        cancelled: false,
        clashReduced: false
      });
    }

    // 3. Resolve head-to-head clashes (A shoots B AND B shoots A)
    const handledPairs = new Set<string>();
    for (const sA of shots) {
      if (!sA.target) continue;
      const sB = shots.find(
        (other) => other.shooter.id === sA.target!.id && other.target?.id === sA.shooter.id
      );
      if (!sB) continue;

      const pairKey = [sA.shooter.id, sB.shooter.id].sort().join('|');
      if (handledPairs.has(pairKey)) continue;
      handledPairs.add(pairKey);

      if (sA.isSuper && !sB.isSuper) {
        // Super Shot suppresses and cancels enemy normal shot!
        sB.cancelled = true;
        events.push({
          type: 'super_suppress',
          actorId: sA.shooter.id,
          targetId: sB.shooter.id,
          isSuper: true,
          message: `${sA.shooter.name} 超级射击压制并击碎了 ${sB.shooter.name} 的子弹！`
        });
      } else if (!sA.isSuper && sB.isSuper) {
        sA.cancelled = true;
        events.push({
          type: 'super_suppress',
          actorId: sB.shooter.id,
          targetId: sA.shooter.id,
          isSuper: true,
          message: `${sB.shooter.name} 超级射击压制并击碎了 ${sA.shooter.name} 的子弹！`
        });
      } else if (sA.isSuper && sB.isSuper) {
        // Double Super Shot clash -> reduced to 1 shockwave damage each!
        sA.clashReduced = true;
        sB.clashReduced = true;
        events.push({
          type: 'shot_clash',
          actorId: sA.shooter.id,
          targetId: sB.shooter.id,
          isSuper: true,
          message: '双超级射击正面轰击！冲击波震伤双方！'
        });
      }
      // Normal vs Normal -> both proceed and each deals 1 damage (confirmed default)
    }

    // 4. Apply remaining shots against targets
    const pendingDamage = new Map<FighterId, number>();

    for (const s of shots) {
      if (s.cancelled || !s.target) continue;
      const target = s.target;
      const targetDefending = target.chosenAction === 'defend' && !target.shieldDisabledThisTurn;

      if (s.isSuper) {
        const dmg = s.clashReduced ? 1 : 2;
        pendingDamage.set(target.id, (pendingDamage.get(target.id) || 0) + dmg);
        target.hitFlash = 1;
        // Super Shot shatters & disables shield for 1 turn!
        target.shieldDisabledNextTurn = true;
        target.shieldShatterAnim = 1;

        if (s.shooter.isPlayer) this.stats.shotsHit += 1;

        if (targetDefending) {
          events.push({
            type: 'super_shatter',
            actorId: s.shooter.id,
            targetId: target.id,
            damage: dmg,
            isSuper: true,
            message: `${s.shooter.name} 超级射击击穿 ${target.name} 防暴盾！暴击 -${dmg}♥，盾牌禁用 1 回合！`
          });
        } else {
          events.push({
            type: 'shot_hit',
            actorId: s.shooter.id,
            targetId: target.id,
            damage: dmg,
            isSuper: true,
            message: `${s.shooter.name} 超级射击命中 ${target.name}！暴击 -${dmg}♥，盾牌损毁 1 回合！`
          });
        }
      } else {
        // Normal shot
        if (targetDefending) {
          target.shieldImpact = 1;
          if (target.isPlayer) this.stats.attacksBlocked += 1;
          events.push({
            type: 'shot_blocked',
            actorId: s.shooter.id,
            targetId: target.id,
            damage: 0,
            isSuper: false,
            message: `${target.name} 举起防暴盾挡下了 ${s.shooter.name} 的射击！`
          });
        } else {
          pendingDamage.set(target.id, (pendingDamage.get(target.id) || 0) + 1);
          target.hitFlash = 1;
          if (s.shooter.isPlayer) this.stats.shotsHit += 1;
          events.push({
            type: 'shot_hit',
            actorId: s.shooter.id,
            targetId: target.id,
            damage: 1,
            isSuper: false,
            message: `${s.shooter.name} 击中 ${target.name}！-1♥`
          });
        }
      }
    }

    // 5. Commit damage & check eliminations
    for (const f of this.fighters) {
      const dmg = pendingDamage.get(f.id) || 0;
      if (dmg > 0 && f.alive) {
        f.hp = Math.max(0, f.hp - dmg);
        if (!f.isPlayer && f.hp > 0) {
          f.pose = 'hurt';
        }
        if (f.hp <= 0) {
          f.alive = false;
          f.pose = 'dead';
          f.deathAnim = 0.01;
          events.push({
            type: 'eliminated',
            actorId: f.id,
            message: `${f.name} 倒下了！`
          });
        }
      }
    }

    this.setPhase('resolve', RESOLVE_DURATION);
    this.callbacks.onResolveEvents(events);
  }

  private finishTurnAndCheckWinner(): void {
    const player = this.getPlayer();
    const aliveOpponents = this.getOpponents().filter((o) => o.alive);

    if (!player.alive && aliveOpponents.length === 0) {
      this.setPhase('gameover', 0);
      this.callbacks.onGameOver('draw', { ...this.stats });
      return;
    }
    if (!player.alive) {
      this.setPhase('gameover', 0);
      this.callbacks.onGameOver('defeat', { ...this.stats });
      return;
    }
    if (aliveOpponents.length === 0) {
      this.setPhase('gameover', 0);
      this.callbacks.onGameOver('victory', { ...this.stats });
      return;
    }

    this.beginNextRound();
  }

  private setPhase(phase: TurnPhase, duration: number): void {
    this.phase = phase;
    this.phaseDuration = duration;
    this.phaseTimer = duration;
    this.lastWholeSecond = -1;
    this.callbacks.onPhaseChange(phase, this.round);
  }

  public getSnapshot(): GameSnapshot {
    return {
      mode: this.mode,
      phase: this.phase,
      round: this.round,
      phaseTimer: Number(this.phaseTimer.toFixed(2)),
      phaseDuration: this.phaseDuration,
      fighters: this.fighters.map((f) => ({
        id: f.id,
        name: f.name,
        hp: f.hp,
        ammo: f.ammo,
        alive: f.alive,
        shieldDisabledThisTurn: f.shieldDisabledThisTurn,
        chosenAction: f.chosenAction,
        targetId: f.targetId
      }))
    };
  }
}
