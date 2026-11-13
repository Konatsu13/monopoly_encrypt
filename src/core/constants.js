/** Shared constants used by the game engine and UI. */

export const SCHEMA_VERSION = 1;
export const SAVE_KEY = 'encrypted-monopoly.save.v1';
export const SETTINGS_KEY = 'encrypted-monopoly.settings.v1';
export const PROLOGUE_SEEN_KEY = 'encrypted-monopoly.prologue-seen.v1';

export const PHASES = {
  WAITING_FOR_ROLL: 'WAITING_FOR_ROLL',
  RESOLVING_SPACE: 'RESOLVING_SPACE',
  PLAYER_DECISION: 'PLAYER_DECISION',
  CARD_DECRYPTION: 'CARD_DECRYPTION',
  AUCTION: 'AUCTION',
  DEBT_RESOLUTION: 'DEBT_RESOLUTION',
  JAIL_DECISION: 'JAIL_DECISION',
  TRADE_PENDING: 'TRADE_PENDING',
  END_TURN: 'END_TURN',
  GAME_OVER: 'GAME_OVER'
};

export const SPACE_TYPES = {
  GO: 'GO',
  PROPERTY: 'PROPERTY',
  RAILROAD: 'RAILROAD',
  UTILITY: 'UTILITY',
  CHANCE: 'CHANCE',
  COMMUNITY_CHEST: 'COMMUNITY_CHEST',
  TAX: 'TAX',
  JAIL: 'JAIL',
  GO_TO_JAIL: 'GO_TO_JAIL',
  FREE_PARKING: 'FREE_PARKING'
};

export const CARD_EFFECT_TYPES = [
  'MOVE_TO',
  'MOVE_RELATIVE',
  'MOVE_TO_NEAREST',
  'COLLECT_BANK',
  'PAY_BANK',
  'COLLECT_EACH',
  'PAY_EACH',
  'GO_TO_JAIL',
  'GET_OUT_OF_JAIL',
  'REPAIR'
];

export const PLAYABLE_PROPERTY_KINDS = ['STREET', 'RAILROAD', 'UTILITY'];

export const DECK_KEYS = ['chance', 'communityChest'];

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 8;

export const DEFAULT_SETTINGS = {
  assistedMode: false,
  revealAnswer: false,
  showBoardPlaintext: false,
  reducedMotion: false,
  demoMode: true
};
