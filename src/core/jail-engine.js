/** Jail decisions and release helpers. */

import { getPlayer } from './game-state.js';
import { useRetainedJailCard } from './card-engine.js';

export function releasePlayer(player) {
  player.inJail = false;
  player.jailTurns = 0;
  player.doublesCount = 0;
}

export function canUseJailCard(state, playerId) {
  const player = getPlayer(state, playerId);
  return Boolean(player && !player.bankrupt && player.inJail && player.jailFreeCardIds.length > 0);
}

export function useJailCard(state, data, playerId) {
  const player = getPlayer(state, playerId);
  if (!player || !player.inJail) return { ok: false, reason: 'Pemain tidak sedang ditahan.' };
  const result = useRetainedJailCard(state, data, playerId);
  if (!result.ok) return result;
  releasePlayer(player);
  return { ok: true, cardId: result.cardId };
}

/**
 * Third failed jail attempt: the player must pay the fine and then move by the
 * rolled total. Returns a descriptor the engine turns into a payment flow.
 */
export function mustPayAfterFailedAttempts(player, profile) {
  return player.inJail && player.jailTurns >= profile.jailMaxTurns;
}
