import { ActionType, Fighter, FighterId } from '../core/types';

export interface AIDecision {
  action: ActionType;
  targetId: FighterId | null;
}

/**
 * Psychological mind-game AI for 1v1 and 1v1v1 modes.
 * Evaluates ammo economy, Super Shot threat, broken shields, and player habit history.
 */
export function decideAIAction(
  me: Fighter,
  allFighters: Fighter[],
  playerHistory: ActionType[],
  round: number
): AIDecision {
  const enemies = allFighters.filter((f) => f.id !== me.id && f.alive);
  if (enemies.length === 0) {
    return { action: 'none', targetId: null };
  }

  const canFire = me.ammo > 0;
  const canReload = me.ammo < me.maxAmmo;
  const canDefend = !me.shieldDisabledThisTurn;
  const hasSuper = me.ammo >= me.maxAmmo;

  // Identify threats
  const armedEnemies = enemies.filter((e) => e.ammo > 0);
  const superEnemies = enemies.filter((e) => e.ammo >= e.maxAmmo);
  const anyEnemyArmed = armedEnemies.length > 0;

  // Pick best target if firing
  const target = pickBestTarget(me, enemies, playerHistory);

  // Rule 1: If we have Super Shot (6 ammo), overwhelmingly unleash it!
  if (hasSuper) {
    // Small bluff chance only if enemy ALSO has super and we want to play mind games,
    // but defending doesn't block Super Shot anyway, so firing is almost always optimal.
    return { action: 'fire', targetId: target.id };
  }

  // Rule 2: First round when nobody has ammo -> always reload!
  if (!canFire && !anyEnemyArmed) {
    return { action: 'reload', targetId: null };
  }

  // Rule 3: If no enemy has ammo, NEVER waste a turn defending.
  if (!anyEnemyArmed) {
    if (!canFire) {
      return { action: 'reload', targetId: null };
    }
    // Enemies are unarmed: strong pressure to fire if target can't defend or is low HP,
    // otherwise mix between punishing with fire and greedily building toward Super Shot.
    const fireWeight =
      target.shieldDisabledThisTurn ? 0.85 :
      target.hp <= 1 ? 0.78 :
      me.ammo >= 4 ? 0.45 :
      0.58;
    return Math.random() < fireWeight
      ? { action: 'fire', targetId: target.id }
      : { action: 'reload', targetId: null };
  }

  // Analyze player's recent tendencies for mind-game reads
  const recent = playerHistory.slice(-3);
  const playerReloadStreak = recent.length >= 2 && recent.every((a) => a === 'reload');
  const playerDefendStreak = recent.length >= 2 && recent.every((a) => a === 'defend');
  const playerFireHeavy = recent.filter((a) => a === 'fire').length >= 2;

  // Calculate action weights
  let wReload = canReload ? 34 : 0;
  let wFire = canFire ? 38 : 0;
  let wDefend = canDefend ? 32 : 0;

  // Ammo economy adjustments
  if (me.ammo === 0) {
    wReload += 32;
    wDefend += 14;
  } else if (me.ammo >= 4 && canReload) {
    // Close to Super Shot (6 ammo) -> tempt greedy charge
    wReload += 18;
  }

  // Threat adjustments
  if (superEnemies.length > 0) {
    // Defending does NOT stop Super Shot! Better to fire or race ammo.
    wDefend *= 0.25;
    if (canFire) wFire += 34;
    if (canReload) wReload += 10;
  } else {
    // Normal armed threats
    if (me.hp <= 2 && canDefend) {
      wDefend += 20;
    }
    if (playerFireHeavy && canDefend) {
      wDefend += 22;
    }
  }

  // Punish predictable patterns
  if (playerReloadStreak && canFire) {
    wFire += 28;
    wDefend *= 0.6;
  }
  if (playerDefendStreak && canReload) {
    wReload += 34;
    wFire *= 0.5;
  }

  // Target vulnerability
  if (target.shieldDisabledThisTurn && canFire) {
    wFire += 35;
  }
  if (target.hp === 1 && canFire) {
    wFire += 25;
  }

  // Early round variance
  if (round === 2 && me.ammo === 1) {
    // Classic Bobo Zan Turn 2 mind-game: Fire / Defend / Greed Reload
    wFire += 8;
    wDefend += 10;
    wReload += 8;
  }

  const total = wReload + wFire + wDefend;
  if (total <= 0) {
    return canReload ? { action: 'reload', targetId: null } : { action: 'none', targetId: null };
  }

  const roll = Math.random() * total;
  if (roll < wReload) {
    return { action: 'reload', targetId: null };
  }
  if (roll < wReload + wFire) {
    return { action: 'fire', targetId: target.id };
  }
  return { action: 'defend', targetId: null };
}

function pickBestTarget(
  me: Fighter,
  enemies: Fighter[],
  playerHistory: ActionType[]
): Fighter {
  if (enemies.length === 1) return enemies[0];

  // Score each opponent in 1v1v1 so AI genuinely engages both the player and the other AI
  let best = enemies[0];
  let bestScore = -Infinity;
  const lastPlayerAction = playerHistory[playerHistory.length - 1];

  for (const enemy of enemies) {
    let score = Math.random() * 26; // unpredictability so triple standoff feels tense
    // High priority: finish off 1-2 HP opponents
    if (enemy.hp <= 1) score += 28;
    else if (enemy.hp <= 2) score += 14;
    // High priority: shield broken target is wide open
    if (enemy.shieldDisabledThisTurn) score += 24;
    // High priority: someone stockpiling toward Super Shot
    score += enemy.ammo * 5.5;
    if (enemy.ammo >= 5) score += 18;
    // If we have Super Shot, prefer targeting someone who is healthy or likely to shield
    if (me.ammo >= me.maxAmmo && enemy.hp >= 2) {
      score += 12;
    }
    // Slight read on player if they just reloaded
    if (enemy.isPlayer && lastPlayerAction === 'reload') {
      score += 6;
    }

    if (score > bestScore) {
      bestScore = score;
      best = enemy;
    }
  }

  return best;
}
