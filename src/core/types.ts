export type GameMode = '1v1' | '1v1v1';

export type ActionType = 'reload' | 'fire' | 'defend' | 'none';

export type FighterId = 'player' | 'ai_left' | 'ai_right';

export type TurnPhase =
  | 'idle'
  | 'decision'
  | 'reveal'
  | 'aiming'
  | 'resolve'
  | 'gameover';

export type FighterPose =
  | 'idle'
  | 'reload'
  | 'defend'
  | 'aim_player'
  | 'aim_side'
  | 'fire_player'
  | 'fire_side'
  | 'hurt'
  | 'dead';

export interface Fighter {
  id: FighterId;
  name: string;
  subtitle: string;
  isPlayer: boolean;
  hp: number;
  maxHp: number;
  ammo: number;
  maxAmmo: number;
  alive: boolean;
  shieldDisabledThisTurn: boolean;
  shieldDisabledNextTurn: boolean;

  // Turn selections
  chosenAction: ActionType;
  isSuperShot: boolean;
  targetId: FighterId | null;
  forfeitedAim: boolean;
  missedShot: boolean;

  // Visual / styling
  accentColor: string;
  tieStyle: 'crimson' | 'cobalt' | 'gold';
  slotX: number; // Normalized 0..1 position across the table

  // Animation timers (seconds)
  pose: FighterPose;
  hitFlash: number;
  recoil: number;
  shieldImpact: number;
  shieldShatterAnim: number;
  reloadAnim: number;
  deathAnim: number;
  breathPhase: number;
}

export interface ResolveEvent {
  type:
    | 'reload'
    | 'shot_hit'
    | 'shot_blocked'
    | 'shot_miss'
    | 'super_shatter'
    | 'shot_clash'
    | 'super_suppress'
    | 'forfeit'
    | 'eliminated';
  actorId: FighterId;
  targetId?: FighterId;
  damage?: number;
  isSuper?: boolean;
  message: string;
}

export interface MatchStats {
  roundsPlayed: number;
  shotsFired: number;
  shotsHit: number;
  superShotsFired: number;
  attacksBlocked: number;
  aimForfeits: number;
}

export interface GameSnapshot {
  mode: GameMode;
  phase: TurnPhase;
  round: number;
  phaseTimer: number;
  phaseDuration: number;
  fighters: Array<{
    id: FighterId;
    name: string;
    hp: number;
    ammo: number;
    alive: boolean;
    shieldDisabledThisTurn: boolean;
    chosenAction: ActionType;
    targetId: FighterId | null;
  }>;
}
