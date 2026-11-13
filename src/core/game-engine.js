/**
 * Central game engine.
 *
 * The engine owns the canonical state. UI code calls public actions and reads
 * the resulting state; it never mutates the state directly. Every forced
 * payment goes through a queue so rent, taxes, card fees, and jail fines all
 * share the same debt-resolution and bankruptcy path.
 */

import { buildCipher } from '../crypto/encryption.js';
import { checkAnswer } from '../crypto/decryption.js';
import {
  createGameState,
  getCurrentPlayer,
  getPlayer,
  getSolventPlayers,
  recordHistory,
  addLog
} from './game-state.js';
import { PHASES, SCHEMA_VERSION } from './constants.js';
import { formatMoney } from '../utils/formatters.js';
import { moveBack, moveBy, moveTo, findNearestSpace, rollDice, sendToJail } from './movement-engine.js';
import { calculateRent, canBuyProperty, buyProperty, getPropertyDefinition } from './property-engine.js';
import {
  buildHouse,
  canBuildHouse,
  canSellBuilding,
  sellBuilding
} from './building-engine.js';
import {
  canMortgage,
  canUnmortgage,
  mortgageProperty,
  unmortgageProperty
} from './mortgage-engine.js';
import { calculateRepairCost, collectFromBank, transferCash } from './economy-engine.js';
import { settleBankruptcy } from './bankruptcy-engine.js';
import { createAuction, placeBid, passAuction } from './auction-engine.js';
import {
  drawCard,
  effectSummary,
  resolveCardIntoDeck
} from './card-engine.js';
import { releasePlayer, useJailCard } from './jail-engine.js';
import { executeTrade, summarizeTrade, validateTrade } from './trade-engine.js';

const MAX_CARD_CHAIN_DEPTH = 4;

export class GameEngine {
  constructor({ state, data, cipher, rng = Math.random }) {
    if (!state || !data) throw new Error('GameEngine membutuhkan state dan data.');
    if (state.schemaVersion !== SCHEMA_VERSION) {
      throw new Error(`Versi save ${state.schemaVersion} tidak didukung.`);
    }
    this.state = state;
    this.data = data;
    this.profile = data.profile;
    this.cipher = cipher ?? buildCipher(state.encryptionConfig);
    this.rng = rng;
    this._busy = false;
  }

  static create({ players, data, cipher, rng = Math.random, settings = {} }) {
    const state = createGameState({
      players,
      data,
      profile: data.profile,
      encryptionConfig: data.encryptionConfig,
      rng,
      settings
    });
    return new GameEngine({ state, data, cipher, rng });
  }

  get currentPlayer() {
    return getCurrentPlayer(this.state);
  }

  get pending() {
    return this.state.pending;
  }

  _fail(reason, extra = {}) {
    return { ok: false, reason, ...extra };
  }

  _guard(allowedPhases) {
    if (!allowedPhases.includes(this.state.phase)) {
      return this._fail(`Aksi ini tidak tersedia pada fase ${this.state.phase}.`);
    }
    return null;
  }

  _action(callback) {
    if (this._busy) return this._fail('Aksi lain sedang diproses. Tunggu sebentar.');
    this._busy = true;
    // Snapshot and restore on unexpected errors so a single action cannot
    // leave the canonical state half-mutated.
    const snapshot = structuredClone(this.state);
    try {
      return callback();
    } catch (error) {
      for (const key of Object.keys(this.state)) delete this.state[key];
      Object.assign(this.state, snapshot);
      return this._fail(`Terjadi kesalahan: ${error.message}`);
    } finally {
      this._busy = false;
    }
  }

  _assetActorId() {
    if (this.state.phase === PHASES.DEBT_RESOLUTION && this.state.pending?.type === 'DEBT') {
      return this.state.pending.debtorId;
    }
    return this.currentPlayer?.id ?? null;
  }

  _beginTurn() {
    const player = this.currentPlayer;
    if (!player) return;
    this.state.pending = null;
    this.state.paymentQueue = [];
    this.state.queueCompletion = null;
    if (player.inJail) {
      this.state.phase = PHASES.JAIL_DECISION;
      addLog(this.state, 'TURN', `Giliran ${player.name}. Pemain berada di Pusat Detensi dan harus memilih tindakan.`, {
        playerId: player.id
      });
    } else {
      this.state.phase = PHASES.WAITING_FOR_ROLL;
      addLog(this.state, 'TURN', `Giliran ${player.name} (turn ${this.state.turnNumber}).`, { playerId: player.id });
    }
  }

  _checkWinner() {
    const solvent = getSolventPlayers(this.state);
    if (solvent.length <= 1) {
      this.state.phase = PHASES.GAME_OVER;
      this.state.winnerId = solvent[0]?.id ?? null;
      this.state.pending = null;
      this.state.paymentQueue = [];
      this.state.queueCompletion = null;
      addLog(
        this.state,
        'GAME_OVER',
        solvent[0]
          ? `${solvent[0].name} adalah investor terakhir yang masih mampu memenuhi kewajiban.`
          : 'Permainan berakhir tanpa investor yang tersisa.',
        { winnerId: this.state.winnerId }
      );
      return true;
    }
    return false;
  }

  _advanceToNextPlayer() {
    if (this._checkWinner()) return;
    const playerCount = this.state.players.length;
    for (let step = 1; step <= playerCount; step += 1) {
      const index = (this.state.currentPlayerIndex + step) % playerCount;
      const candidate = this.state.players[index];
      if (candidate && !candidate.bankrupt) {
        this.state.currentPlayerIndex = index;
        this.state.turnNumber += 1;
        this.state.lastMove = null;
        this.state.lastDice = null;
        this._beginTurn();
        return;
      }
    }
    this._checkWinner();
  }

  _finishResolution() {
    const player = this.currentPlayer;
    this.state.pending = null;
    if (!player || player.bankrupt) {
      this._checkWinner();
      return;
    }
    if (player.inJail) {
      this.state.phase = PHASES.END_TURN;
      return;
    }
    if (player.doublesCount > 0) {
      this.state.phase = PHASES.WAITING_FOR_ROLL;
      addLog(this.state, 'TURN', `${player.name} mendapat lemparan ganda dan boleh melempar lagi.`, {
        playerId: player.id
      });
      return;
    }
    this.state.phase = PHASES.END_TURN;
  }

  _completeQueue(completion) {
    if (!completion) return;
    this.state.queueCompletion = null;
    switch (completion.type) {
      case 'FINISH_RESOLUTION':
        this._finishResolution();
        break;
      case 'END_TURN':
        this.state.phase = PHASES.END_TURN;
        break;
      case 'RELEASE_FROM_JAIL': {
        const player = getPlayer(this.state, completion.playerId ?? this.currentPlayer?.id);
        if (player && !player.bankrupt) {
          releasePlayer(player);
          this.state.phase = PHASES.WAITING_FOR_ROLL;
          addLog(this.state, 'JAIL', `${player.name} membayar denda dan keluar dari Pusat Detensi.`, {
            playerId: player.id
          });
        }
        break;
      }
      case 'JAIL_FORCED_MOVE': {
        const player = getPlayer(this.state, completion.playerId);
        if (player && !player.bankrupt) {
          releasePlayer(player);
          addLog(this.state, 'JAIL', `${player.name} membayar denda setelah tiga percobaan dan bergerak sesuai dadu.`, {
            playerId: player.id
          });
          moveBy(this.state, this.data, this.profile, player.id, completion.steps, {
            collectGo: true,
            reason: 'Keluar dari penjara setelah denda'
          });
          this._resolveLanding(player.id, { depth: 1, reason: 'Pembebasan paksa dari penjara' });
        }
        break;
      }
      case 'NONE':
      default:
        break;
    }
  }

  _processPaymentQueue() {
    const queue = this.state.paymentQueue;
    while (queue.length > 0) {
      const item = queue[0];
      const payer = getPlayer(this.state, item.fromId);
      const recipient = item.toId ? getPlayer(this.state, item.toId) : null;

      if (!payer || payer.bankrupt || (item.toId && (!recipient || recipient.bankrupt)) || payer.id === item.toId) {
        queue.shift();
        continue;
      }

      if (payer.cash >= item.amount) {
        transferCash(this.state, this.profile, item);
        queue.shift();
        continue;
      }

      this.state.pending = {
        type: 'DEBT',
        debtorId: item.fromId,
        creditorId: item.toId ?? null,
        amount: item.amount,
        reason: item.reason
      };
      this.state.phase = PHASES.DEBT_RESOLUTION;
      addLog(
        this.state,
        'DEBT',
        `${payer.name} belum mampu membayar ${formatMoney(item.amount, this.profile.currency)} (${item.reason}). Gunakan aset atau nyatakan bangkrut.`,
        { playerId: payer.id, amount: item.amount }
      );
      return { paused: true };
    }

    this.state.paymentQueue = [];
    const completion = this.state.queueCompletion;
    this.state.queueCompletion = null;
    this._completeQueue(completion);
    return { paused: false };
  }

  _enqueuePayments(items, completion) {
    const filtered = items.filter((item) => {
      if (!Number.isInteger(item.amount) || item.amount <= 0) return false;
      const payer = getPlayer(this.state, item.fromId);
      const recipient = item.toId ? getPlayer(this.state, item.toId) : null;
      if (!payer || payer.bankrupt) return false;
      if (item.toId && (!recipient || recipient.bankrupt)) return false;
      if (item.toId === item.fromId) return false;
      return true;
    });

    if (filtered.length === 0) {
      this._completeQueue(completion);
      return;
    }

    this.state.paymentQueue = filtered;
    this.state.queueCompletion = completion;
    this._processPaymentQueue();
  }

  _resolveLanding(playerId, options = {}) {
    const depth = options.depth ?? 0;
    const player = getPlayer(this.state, playerId);
    if (!player || player.bankrupt) return;

    if (depth > MAX_CARD_CHAIN_DEPTH) {
      addLog(this.state, 'SYSTEM', 'Rantai perpindahan kartu dihentikan untuk mencegah perulangan.');
      this._finishResolution();
      return;
    }

    const space = this.data.spacesByIndex[player.position];
    if (!space) {
      addLog(this.state, 'SYSTEM', `Petak posisi ${player.position} tidak ditemukan.`);
      this._finishResolution();
      return;
    }

    this.state.phase = PHASES.RESOLVING_SPACE;

    switch (space.type) {
      case 'GO': {
        addLog(this.state, 'MOVE', `${player.name} berhenti di Gerbang Kota.`, { playerId });
        this._finishResolution();
        return;
      }
      case 'PROPERTY':
      case 'RAILROAD':
      case 'UTILITY': {
        const propertyState = this.state.properties[space.id];
        const definition = getPropertyDefinition(this.data, space.id);
        if (!propertyState || !definition) {
          addLog(this.state, 'SYSTEM', `Data properti petak ${space.index} tidak lengkap.`);
          this._finishResolution();
          return;
        }

        if (!propertyState.ownerId) {
          this.state.pending = {
            type: 'BUY_OR_AUCTION',
            spaceId: space.id,
            playerId,
            price: definition.price
          };
          this.state.phase = PHASES.PLAYER_DECISION;
          addLog(
            this.state,
            'PROPERTY',
            `${player.name} mendarat di properti tanpa pemilik (petak ${space.index}). Harga ${formatMoney(definition.price, this.profile.currency)}.`,
            { playerId, spaceId: space.id }
          );
          return;
        }

        const owner = getPlayer(this.state, propertyState.ownerId);
        if (!owner || owner.bankrupt) {
          propertyState.ownerId = null;
          propertyState.mortgaged = false;
          this.state.pending = {
            type: 'BUY_OR_AUCTION',
            spaceId: space.id,
            playerId,
            price: definition.price
          };
          this.state.phase = PHASES.PLAYER_DECISION;
          return;
        }

        if (propertyState.ownerId === playerId) {
          addLog(this.state, 'PROPERTY', `${player.name} mendarat di properti miliknya sendiri (petak ${space.index}).`, {
            playerId,
            spaceId: space.id
          });
          this._finishResolution();
          return;
        }

        const rent = calculateRent(this.state, this.data, this.profile, space.id, {
          diceTotal: options.diceTotal ?? this.state.lastDice?.total,
          rentMultiplier: options.rentMultiplier
        });

        if (rent.amount <= 0) {
          addLog(
            this.state,
            'RENT',
            `Tidak ada sewa di petak ${space.index}: ${propertyState.mortgaged ? 'properti digadaikan' : 'tidak ada tagihan'}.`,
            { playerId, spaceId: space.id }
          );
          this._finishResolution();
          return;
        }

        addLog(
          this.state,
          'RENT',
          `${player.name} membayar sewa ${formatMoney(rent.amount, this.profile.currency)} kepada ${owner.name} untuk petak ${space.index} (${rent.description}).`,
          { playerId, spaceId: space.id, amount: rent.amount, ownerId: owner.id }
        );
        this._enqueuePayments(
          [{ fromId: playerId, toId: owner.id, amount: rent.amount, reason: `Sewa petak ${space.index}` }],
          { type: 'FINISH_RESOLUTION' }
        );
        return;
      }
      case 'TAX': {
        const amount = space.taxAmount;
        addLog(this.state, 'TAX', `${player.name} dikenai ${space.name ? 'pajak kota' : 'pajak'} ${formatMoney(amount, this.profile.currency)} di petak ${space.index}.`, {
          playerId,
          amount
        });
        this._enqueuePayments(
          [{ fromId: playerId, toId: null, amount, reason: `Pajak petak ${space.index}` }],
          { type: 'FINISH_RESOLUTION' }
        );
        return;
      }
      case 'CHANCE':
      case 'COMMUNITY_CHEST': {
        const deckKey = space.type === 'CHANCE' ? 'chance' : 'communityChest';
        const drawn = drawCard(this.state, this.data, this.rng, deckKey, playerId);
        if (!drawn.ok) {
          addLog(this.state, 'SYSTEM', `Tidak dapat menarik kartu: ${drawn.reason}`);
          this._finishResolution();
          return;
        }
        this.state.pending = {
          type: 'CARD',
          cardId: drawn.card.id,
          deck: deckKey,
          playerId,
          attempts: 0,
          verified: false,
          effectApplied: false
        };
        this.state.phase = PHASES.CARD_DECRYPTION;
        return;
      }
      case 'GO_TO_JAIL': {
        addLog(this.state, 'JAIL', `${player.name} mendarat di Gerbang Penjara.`, { playerId });
        sendToJail(this.state, this.profile, playerId, 'Petak Gerbang Penjara');
        this.state.phase = PHASES.END_TURN;
        return;
      }
      case 'JAIL': {
        addLog(this.state, 'JAIL', `${player.name} hanya mengunjungi Pusat Detensi.`, { playerId });
        this._finishResolution();
        return;
      }
      case 'FREE_PARKING': {
        addLog(this.state, 'MOVE', `${player.name} berhenti di Taman Netral. Tidak ada jackpot pada profil ini.`, {
          playerId
        });
        this._finishResolution();
        return;
      }
      default: {
        addLog(this.state, 'SYSTEM', `Tipe petak ${space.type} tidak memiliki efek.`);
        this._finishResolution();
      }
    }
  }

  /** Roll the dice and move the active player. */
  roll() {
    return this._action(() => {
      const phaseError = this._guard([PHASES.WAITING_FOR_ROLL]);
      if (phaseError) return phaseError;

      const player = this.currentPlayer;
      if (player.inJail) return this._fail('Pemain sedang ditahan; gunakan keputusan penjara.');

      const dice = rollDice(this.rng);
      this.state.lastDice = { ...dice, playerId: player.id };
      this.state.stats.rolls += 1;
      addLog(
        this.state,
        'DICE',
        `${player.name} melempar ${dice.d1} + ${dice.d2} = ${dice.total}${dice.isDouble ? ' (ganda)' : ''}.`,
        { playerId: player.id, ...dice }
      );

      if (dice.isDouble) {
        player.doublesCount += 1;
        if (player.doublesCount >= 3) {
          addLog(this.state, 'JAIL', `${player.name} mendapat tiga lemparan ganda berturut-turut dan masuk Pusat Detensi.`, {
            playerId: player.id
          });
          sendToJail(this.state, this.profile, player.id, 'Tiga lemparan ganda');
          this.state.phase = PHASES.END_TURN;
          return { ok: true, dice, tripleDouble: true, phase: this.state.phase };
        }
      } else {
        player.doublesCount = 0;
      }

      moveBy(this.state, this.data, this.profile, player.id, dice.total, {
        collectGo: true,
        reason: 'Hasil dadu'
      });
      this._resolveLanding(player.id, { depth: 0 });

      return {
        ok: true,
        dice,
        movement: this.state.lastMove,
        phase: this.state.phase,
        pending: this.state.pending
      };
    });
  }

  /** Buy the property currently offered after landing. */
  buyProperty() {
    return this._action(() => {
      const phaseError = this._guard([PHASES.PLAYER_DECISION]);
      if (phaseError) return phaseError;
      const pending = this.state.pending;
      if (!pending || pending.type !== 'BUY_OR_AUCTION') return this._fail('Tidak ada properti untuk dibeli.');

      const validation = canBuyProperty(this.state, this.data, pending.playerId, pending.spaceId);
      if (!validation.ok) return validation;

      const result = buyProperty(this.state, this.data, this.profile, pending.playerId, pending.spaceId);
      if (!result.ok) return result;
      this._finishResolution();
      return { ok: true, ...result, phase: this.state.phase };
    });
  }

  /** Decline the purchase and open an auction (when the profile requires it). */
  declinePurchase() {
    return this._action(() => {
      const phaseError = this._guard([PHASES.PLAYER_DECISION]);
      if (phaseError) return phaseError;
      const pending = this.state.pending;
      if (!pending || pending.type !== 'BUY_OR_AUCTION') return this._fail('Tidak ada properti untuk dilelang.');

      if (!this.profile.auctionEnabled) {
        addLog(this.state, 'AUCTION', 'Properti tidak dibeli; lelang dinonaktifkan oleh profil edisi.');
        this._finishResolution();
        return { ok: true, auction: false, phase: this.state.phase };
      }

      const auction = createAuction(this.state, this.data, this.profile, pending.spaceId, pending.playerId);
      addLog(
        this.state,
        'AUCTION',
        `Properti petak ${this.data.spacesById[pending.spaceId].index} dilelang. Penawaran dimulai dari ${getPlayer(this.state, auction.currentBidderId)?.name}.`,
        { spaceId: pending.spaceId }
      );
      return { ok: true, auction: true, phase: this.state.phase };
    });
  }

  _completeAuction(result) {
    const auction = this.state.pending;
    if (!auction || auction.type !== 'AUCTION') return;

    if (result.ended === 'SOLD') {
      const winner = getPlayer(this.state, result.winnerId);
      const property = this.state.properties[auction.spaceId];
      const definition = getPropertyDefinition(this.data, auction.spaceId);
      if (!winner || winner.cash < result.price || !property || property.ownerId) {
        addLog(this.state, 'AUCTION', 'Lelang dibatalkan karena data pemenang tidak valid.');
      } else {
        winner.cash -= result.price;
        property.ownerId = winner.id;
        recordHistory(this.state, {
          type: 'AUCTION',
          playerId: winner.id,
          spaceId: auction.spaceId,
          amount: result.price,
          reason: 'Pemenang lelang'
        });
        addLog(
          this.state,
          'AUCTION',
          `${winner.name} memenangkan lelang properti petak ${this.data.spacesById[auction.spaceId].index} seharga ${formatMoney(result.price, this.profile.currency)}.`,
          { playerId: winner.id, spaceId: auction.spaceId, amount: result.price }
        );
        if (definition) property.ownerId = winner.id;
      }
    } else if (result.ended === 'UNSOLD') {
      addLog(this.state, 'AUCTION', 'Semua peserta lewat; properti tetap tanpa pemilik.', {
        spaceId: auction.spaceId
      });
    }

    this.state.pending = null;
    if (this.state.phase === PHASES.AUCTION) this.state.phase = PHASES.RESOLVING_SPACE;
    this._finishResolution();
  }

  auctionBid(amount, playerId = null) {
    return this._action(() => {
      const phaseError = this._guard([PHASES.AUCTION]);
      if (phaseError) return phaseError;
      const auction = this.state.pending;
      if (!auction) return this._fail('Lelang tidak aktif.');
      const bidderId = playerId ?? auction.currentBidderId;
      const result = placeBid(this.state, this.data, this.profile, bidderId, amount);
      if (!result.ok) return result;
      if (result.ended) this._completeAuction(result);
      return { ok: true, ...result, phase: this.state.phase, pending: this.state.pending };
    });
  }

  auctionPass(playerId = null) {
    return this._action(() => {
      const phaseError = this._guard([PHASES.AUCTION]);
      if (phaseError) return phaseError;
      const auction = this.state.pending;
      if (!auction) return this._fail('Lelang tidak aktif.');
      const result = passAuction(this.state, playerId ?? auction.currentBidderId);
      if (!result.ok) return result;
      if (result.ended) this._completeAuction(result);
      return { ok: true, ...result, phase: this.state.phase, pending: this.state.pending };
    });
  }

  /** Check a typed decryption answer. A wrong answer never applies an effect. */
  checkCardAnswer(answer) {
    return this._action(() => {
      const phaseError = this._guard([PHASES.CARD_DECRYPTION]);
      if (phaseError) return phaseError;
      const pending = this.state.pending;
      if (!pending || pending.type !== 'CARD') return this._fail('Tidak ada kartu untuk dideskripsi.');
      const card = this.data.cardsById[pending.cardId];
      if (!card) return this._fail('Data kartu tidak ditemukan.');

      if (pending.verified) {
        return { ok: true, correct: true, alreadyVerified: true, plaintext: card.plaintext, cardId: card.id };
      }

      pending.attempts += 1;
      const comparison = checkAnswer(card.plaintext, answer);
      if (!comparison.correct) {
        this.state.stats.failedDecodeAttempts += 1;
        addLog(this.state, 'CARD', `Jawaban dekripsi belum cocok (percobaan ${pending.attempts}). Efek belum dijalankan.`, {
          playerId: pending.playerId
        });
        return {
          ok: true,
          correct: false,
          empty: comparison.empty,
          attempts: pending.attempts,
          message: comparison.empty ? 'Tuliskan hasil dekripsi terlebih dahulu.' : 'Jawaban belum cocok. Periksa urutan invers fungsi.'
        };
      }

      pending.verified = true;
      this.state.stats.cardsDecoded += 1;
      addLog(this.state, 'CARD', `${getPlayer(this.state, pending.playerId)?.name ?? 'Investor'} berhasil mendekripsi kartu. Efek menunggu konfirmasi.`, {
        playerId: pending.playerId
      });
      return { ok: true, correct: true, plaintext: card.plaintext, cardId: card.id };
    });
  }

  /** Optional assisted decode. Disabled by default. */
  useAssistance() {
    return this._action(() => {
      const phaseError = this._guard([PHASES.CARD_DECRYPTION]);
      if (phaseError) return phaseError;
      const pending = this.state.pending;
      if (!pending || pending.type !== 'CARD') return this._fail('Tidak ada kartu untuk dibantu.');
      if (!this.state.settings.assistedMode && !this.state.settings.revealAnswer) {
        return this._fail('Mode bantuan tidak diaktifkan di Pengaturan.');
      }
      const card = this.data.cardsById[pending.cardId];
      pending.verified = true;
      this.state.stats.cardsDecoded += 1;
      addLog(this.state, 'CARD', 'Bantuan dekripsi digunakan. Pemain tetap harus mengonfirmasi efek.', {
        playerId: pending.playerId
      });
      return { ok: true, plaintext: card.plaintext, assisted: true, cardId: card.id };
    });
  }

  /** Apply the verified card effect exactly once and close the card step. */
  applyPendingCard() {
    return this._action(() => {
      const phaseError = this._guard([PHASES.CARD_DECRYPTION]);
      if (phaseError) return phaseError;
      const pending = this.state.pending;
      if (!pending || pending.type !== 'CARD') return this._fail('Tidak ada kartu untuk diterapkan.');
      if (!pending.verified) return this._fail('Dekripsi belum berhasil; efek tidak boleh dijalankan.');
      if (pending.effectApplied) return this._fail('Efek kartu sudah diterapkan.');

      const card = this.data.cardsById[pending.cardId];
      const player = getPlayer(this.state, pending.playerId);
      if (!card || !player) return this._fail('Data kartu atau pemain tidak ditemukan.');

      pending.effectApplied = true;
      resolveCardIntoDeck(this.state, this.data, card, player.id);

      this.state.pending = null;
      this.state.phase = PHASES.RESOLVING_SPACE;
      const effect = card.effect;

      switch (effect.type) {
        case 'MOVE_TO': {
          const target = this.data.spacesById[effect.spaceId];
          moveTo(this.state, this.data, this.profile, player.id, target.index, {
            collectGo: effect.collectGo !== false,
            reason: 'Efek kartu'
          });
          this._resolveLanding(player.id, { depth: 1, reason: 'Efek kartu' });
          break;
        }
        case 'MOVE_RELATIVE': {
          if (effect.steps >= 0) {
            moveBy(this.state, this.data, this.profile, player.id, effect.steps, {
              collectGo: effect.collectGo === true,
              reason: 'Efek kartu'
            });
          } else {
            moveBack(this.state, player.id, Math.abs(effect.steps), 'Efek kartu');
          }
          this._resolveLanding(player.id, { depth: 1, reason: 'Efek kartu' });
          break;
        }
        case 'MOVE_TO_NEAREST': {
          const nearest = findNearestSpace(this.data, player.position, effect.kind);
          if (!nearest) {
            addLog(this.state, 'CARD', `Tidak ditemukan ${effect.kind} terdekat.`);
            this._finishResolution();
            break;
          }
          moveTo(this.state, this.data, this.profile, player.id, nearest.index, {
            collectGo: true,
            reason: 'Kartu menuju lokasi terdekat'
          });
          let diceTotal = this.state.lastDice?.total;
          const property = this.state.properties[nearest.id];
          if (nearest.type === 'UTILITY' && property?.ownerId && property.ownerId !== player.id) {
            const utilityDice = rollDice(this.rng);
            diceTotal = utilityDice.total;
            this.state.lastCardDice = utilityDice;
            addLog(this.state, 'CARD', `Dadu utilitas untuk kartu: ${utilityDice.d1} + ${utilityDice.d2} = ${utilityDice.total}.`);
          }
          this._resolveLanding(player.id, {
            depth: 1,
            rentMultiplier: effect.rentMultiplier,
            diceTotal,
            reason: 'Kartu menuju lokasi terdekat'
          });
          break;
        }
        case 'COLLECT_BANK': {
          collectFromBank(this.state, this.profile, player.id, effect.amount, 'Efek kartu');
          this._finishResolution();
          break;
        }
        case 'PAY_BANK': {
          this._enqueuePayments(
            [{ fromId: player.id, toId: null, amount: effect.amount, reason: 'Efek kartu' }],
            { type: 'FINISH_RESOLUTION' }
          );
          break;
        }
        case 'COLLECT_EACH': {
          const items = getSolventPlayers(this.state)
            .filter((other) => other.id !== player.id)
            .map((other) => ({
              fromId: other.id,
              toId: player.id,
              amount: effect.amount,
              reason: 'Efek kartu (terima dari setiap pemain)'
            }));
          this._enqueuePayments(items, { type: 'FINISH_RESOLUTION' });
          break;
        }
        case 'PAY_EACH': {
          const items = getSolventPlayers(this.state)
            .filter((other) => other.id !== player.id)
            .map((other) => ({
              fromId: player.id,
              toId: other.id,
              amount: effect.amount,
              reason: 'Efek kartu (bayar setiap pemain)'
            }));
          this._enqueuePayments(items, { type: 'FINISH_RESOLUTION' });
          break;
        }
        case 'GO_TO_JAIL': {
          sendToJail(this.state, this.profile, player.id, 'Efek kartu');
          this.state.phase = PHASES.END_TURN;
          break;
        }
        case 'GET_OUT_OF_JAIL': {
          addLog(this.state, 'CARD', `${player.name} menyimpan kartu bebas penjara.`, { playerId: player.id });
          this._finishResolution();
          break;
        }
        case 'REPAIR': {
          const repair = calculateRepairCost(this.state, this.data, player.id, effect.perHouse, effect.perHotel);
          addLog(
            this.state,
            'CARD',
            `Perbaikan: ${repair.houses} rumah, ${repair.hotels} hotel; total ${formatMoney(repair.amount, this.profile.currency)}.`,
            { playerId: player.id, amount: repair.amount }
          );
          if (repair.amount > 0) {
            this._enqueuePayments(
              [{ fromId: player.id, toId: null, amount: repair.amount, reason: 'Biaya perbaikan kartu' }],
              { type: 'FINISH_RESOLUTION' }
            );
          } else {
            this._finishResolution();
          }
          break;
        }
        default: {
          addLog(this.state, 'SYSTEM', `Tipe efek kartu tidak didukung: ${effect.type}. Efek tidak dijalankan.`);
          this._finishResolution();
          return this._fail(`Tipe efek kartu tidak didukung: ${effect.type}`);
        }
      }

      return {
        ok: true,
        cardId: card.id,
        effectType: effect.type,
        summary: effectSummary(card, this.profile),
        phase: this.state.phase,
        pending: this.state.pending
      };
    });
  }

  /** End the current turn. Blocked while any decision/payment remains. */
  endTurn() {
    return this._action(() => {
      const phaseError = this._guard([PHASES.END_TURN]);
      if (phaseError) return phaseError;
      if (this.state.pending || this.state.paymentQueue.length > 0) {
        return this._fail('Masih ada keputusan atau pembayaran yang belum diselesaikan.');
      }
      const player = this.currentPlayer;
      if (!player) return this._fail('Pemain aktif tidak ditemukan.');
      player.doublesCount = 0;
      this.state.stats.turnsPlayed += 1;
      addLog(this.state, 'TURN', `${player.name} mengakhiri giliran.`, { playerId: player.id });
      this._advanceToNextPlayer();
      return { ok: true, phase: this.state.phase, playerId: this.currentPlayer?.id };
    });
  }

  /** Pay the outstanding debt after raising enough cash. */
  payDebt() {
    return this._action(() => {
      const phaseError = this._guard([PHASES.DEBT_RESOLUTION]);
      if (phaseError) return phaseError;
      const pending = this.state.pending;
      if (!pending || pending.type !== 'DEBT') return this._fail('Tidak ada utang aktif.');
      const debtor = getPlayer(this.state, pending.debtorId);
      if (!debtor) return this._fail('Debitur tidak ditemukan.');
      if (debtor.cash < pending.amount) {
        return this._fail(`Saldo masih kurang. Butuh ${formatMoney(pending.amount - debtor.cash, this.profile.currency)} lagi.`);
      }

      const item = this.state.paymentQueue[0];
      if (item && item.fromId === pending.debtorId && item.amount === pending.amount) {
        transferCash(this.state, this.profile, item);
        this.state.paymentQueue.shift();
        this.state.pending = null;
        this._processPaymentQueue();
      } else {
        transferCash(this.state, this.profile, {
          fromId: pending.debtorId,
          toId: pending.creditorId,
          amount: pending.amount,
          reason: pending.reason
        });
        this.state.pending = null;
        this.state.paymentQueue = [];
        this.state.queueCompletion = null;
        this._finishResolution();
      }

      return { ok: true, phase: this.state.phase, pending: this.state.pending };
    });
  }

  /** Declare bankruptcy; assets settle immediately, then the game checks for a winner. */
  declareBankruptcy() {
    return this._action(() => {
      const phaseError = this._guard([PHASES.DEBT_RESOLUTION]);
      if (phaseError) return phaseError;
      const pending = this.state.pending;
      if (!pending || pending.type !== 'DEBT') return this._fail('Tidak ada utang aktif.');
      const debtor = getPlayer(this.state, pending.debtorId);
      if (!debtor) return this._fail('Debitur tidak ditemukan.');
      if (debtor.cash >= pending.amount) {
        return this._fail('Saldo masih cukup untuk membayar; gunakan tombol Bayar Utang.');
      }

      const queueSnapshot = [...this.state.paymentQueue];
      const completion = this.state.queueCompletion;
      const summary = settleBankruptcy(this.state, this.data, this.profile, pending.debtorId, pending.creditorId);
      if (!summary.ok) return summary;

      const wasCurrent = this.currentPlayer?.id === pending.debtorId;
      this.state.pending = null;
      this.state.paymentQueue = [];
      this.state.queueCompletion = null;

      if (this._checkWinner()) {
        return { ok: true, summary, gameOver: true, phase: this.state.phase, winnerId: this.state.winnerId };
      }

      if (wasCurrent) {
        this._advanceToNextPlayer();
      } else {
        const remaining = queueSnapshot.filter(
          (item) => item.fromId !== pending.debtorId && (item.toId ?? null) !== pending.debtorId
        );
        if (remaining.length > 0) {
          this.state.paymentQueue = remaining;
          this.state.queueCompletion = completion;
          this._processPaymentQueue();
        } else {
          this._completeQueue(completion);
        }
        this._checkWinner();
      }

      return { ok: true, summary, phase: this.state.phase, gameOver: this.state.phase === PHASES.GAME_OVER };
    });
  }

  // --- Jail -------------------------------------------------------------

  jailRoll() {
    return this._action(() => {
      const phaseError = this._guard([PHASES.JAIL_DECISION]);
      if (phaseError) return phaseError;
      const player = this.currentPlayer;
      if (!player?.inJail) return this._fail('Pemain tidak sedang ditahan.');

      const dice = rollDice(this.rng);
      this.state.lastDice = { ...dice, playerId: player.id };
      this.state.stats.rolls += 1;
      addLog(
        this.state,
        'DICE',
        `${player.name} melempar ${dice.d1} + ${dice.d2} = ${dice.total} untuk keluar dari penjara.`,
        { playerId: player.id, ...dice }
      );

      if (dice.isDouble) {
        releasePlayer(player);
        addLog(this.state, 'JAIL', `${player.name} mendapat dadu ganda dan langsung keluar dari penjara.`, {
          playerId: player.id
        });
        moveBy(this.state, this.data, this.profile, player.id, dice.total, {
          collectGo: true,
          reason: 'Keluar dari penjara'
        });
        this._resolveLanding(player.id, { depth: 0 });
        return { ok: true, dice, released: true, phase: this.state.phase, movement: this.state.lastMove };
      }

      player.jailTurns += 1;
      if (player.jailTurns >= this.profile.jailMaxTurns) {
        const fine = this.profile.jailFine;
        addLog(
          this.state,
          'JAIL',
          `${player.name} gagal tiga kali; wajib membayar denda ${formatMoney(fine, this.profile.currency)} lalu bergerak.`,
          { playerId: player.id }
        );
        if (fine === 0 || player.cash >= fine) {
          if (fine > 0) {
            transferCash(this.state, this.profile, {
              fromId: player.id,
              toId: null,
              amount: fine,
              reason: 'Denda penjara (percobaan ketiga)'
            });
          }
          releasePlayer(player);
          moveBy(this.state, this.data, this.profile, player.id, dice.total, {
            collectGo: true,
            reason: 'Keluar setelah denda penjara'
          });
          this._resolveLanding(player.id, { depth: 0 });
          return { ok: true, dice, released: true, paidFine: true, phase: this.state.phase };
        }

        this._enqueuePayments(
          [
            {
              fromId: player.id,
              toId: null,
              amount: fine,
              reason: 'Denda penjara (percobaan ketiga)'
            }
          ],
          { type: 'JAIL_FORCED_MOVE', steps: dice.total, playerId: player.id }
        );
        return { ok: true, dice, released: false, debt: true, phase: this.state.phase };
      }

      addLog(this.state, 'JAIL', `${player.name} belum mendapat dadu ganda dan tetap ditahan (percobaan ${player.jailTurns}).`, {
        playerId: player.id
      });
      this.state.phase = PHASES.END_TURN;
      return { ok: true, dice, released: false, phase: this.state.phase };
    });
  }

  jailPayFine() {
    return this._action(() => {
      const phaseError = this._guard([PHASES.JAIL_DECISION]);
      if (phaseError) return phaseError;
      const player = this.currentPlayer;
      if (!player?.inJail) return this._fail('Pemain tidak sedang ditahan.');
      const fine = this.profile.jailFine;

      if (fine === 0 || player.cash >= fine) {
        if (fine > 0) {
          transferCash(this.state, this.profile, {
            fromId: player.id,
            toId: null,
            amount: fine,
            reason: 'Denda penjara'
          });
        }
        releasePlayer(player);
        this.state.phase = PHASES.WAITING_FOR_ROLL;
        addLog(this.state, 'JAIL', `${player.name} membayar denda dan keluar dari penjara.`, { playerId: player.id });
        return { ok: true, paid: true, phase: this.state.phase };
      }

      this._enqueuePayments(
        [{ fromId: player.id, toId: null, amount: fine, reason: 'Denda penjara' }],
        { type: 'RELEASE_FROM_JAIL', playerId: player.id }
      );
      return { ok: true, paid: false, debt: true, phase: this.state.phase };
    });
  }

  jailUseCard() {
    return this._action(() => {
      const phaseError = this._guard([PHASES.JAIL_DECISION]);
      if (phaseError) return phaseError;
      const player = this.currentPlayer;
      if (!player?.inJail) return this._fail('Pemain tidak sedang ditahan.');
      const result = useJailCard(this.state, this.data, player.id);
      if (!result.ok) return result;
      this.state.phase = PHASES.WAITING_FOR_ROLL;
      return { ok: true, ...result, phase: this.state.phase };
    });
  }

  // --- Assets ------------------------------------------------------------

  build(spaceId) {
    return this._action(() => {
      const phaseError = this._guard([PHASES.WAITING_FOR_ROLL, PHASES.END_TURN]);
      if (phaseError) return phaseError;
      const playerId = this.currentPlayer?.id;
      if (!playerId) return this._fail('Pemain aktif tidak ditemukan.');
      const result = buildHouse(this.state, this.data, this.profile, playerId, spaceId);
      return { ...result, phase: this.state.phase };
    });
  }

  sellBuilding(spaceId) {
    return this._action(() => {
      const phaseError = this._guard([
        PHASES.WAITING_FOR_ROLL,
        PHASES.END_TURN,
        PHASES.DEBT_RESOLUTION
      ]);
      if (phaseError) return phaseError;
      const playerId = this._assetActorId();
      if (!playerId) return this._fail('Pemain aktif tidak ditemukan.');
      const result = sellBuilding(this.state, this.data, this.profile, playerId, spaceId);
      return { ...result, phase: this.state.phase };
    });
  }

  mortgage(spaceId) {
    return this._action(() => {
      const phaseError = this._guard([
        PHASES.WAITING_FOR_ROLL,
        PHASES.END_TURN,
        PHASES.DEBT_RESOLUTION
      ]);
      if (phaseError) return phaseError;
      const playerId = this._assetActorId();
      if (!playerId) return this._fail('Pemain aktif tidak ditemukan.');
      const result = mortgageProperty(this.state, this.data, this.profile, playerId, spaceId);
      return { ...result, phase: this.state.phase };
    });
  }

  unmortgage(spaceId) {
    return this._action(() => {
      const phaseError = this._guard([PHASES.WAITING_FOR_ROLL, PHASES.END_TURN]);
      if (phaseError) return phaseError;
      const playerId = this.currentPlayer?.id;
      if (!playerId) return this._fail('Pemain aktif tidak ditemukan.');
      const result = unmortgageProperty(this.state, this.data, this.profile, playerId, spaceId);
      return { ...result, phase: this.state.phase };
    });
  }

  /** Read-only validation helpers used by the asset UI. */
  getBuildStatus(spaceId) {
    return canBuildHouse(this.state, this.data, this.profile, this._assetActorId(), spaceId);
  }

  getSellStatus(spaceId) {
    return canSellBuilding(this.state, this.data, this.profile, this._assetActorId(), spaceId);
  }

  getMortgageStatus(spaceId) {
    return canMortgage(this.state, this.data, this._assetActorId(), spaceId);
  }

  getUnmortgageStatus(spaceId) {
    return canUnmortgage(this.state, this.data, this.profile, this._assetActorId(), spaceId);
  }

  // --- Trading -----------------------------------------------------------

  proposeTrade(proposal) {
    return this._action(() => {
      const phaseError = this._guard([PHASES.WAITING_FOR_ROLL, PHASES.END_TURN]);
      if (phaseError) return phaseError;
      const fromId = this.currentPlayer?.id;
      if (!fromId) return this._fail('Pemain aktif tidak ditemukan.');
      const normalized = { ...proposal, fromId };
      const validation = validateTrade(this.state, this.data, this.profile, normalized);
      if (!validation.ok) return validation;

      this.state.pending = {
        type: 'TRADE',
        stage: 'offer',
        proposal: normalized,
        resumePhase: this.state.phase
      };
      this.state.phase = PHASES.TRADE_PENDING;
      addLog(this.state, 'TRADE', `${this.currentPlayer.name} menyusun penawaran pertukaran.`, {
        playerId: fromId
      });
      return {
        ok: true,
        summary: summarizeTrade(this.state, this.data, this.profile, normalized),
        stage: 'offer',
        phase: this.state.phase
      };
    });
  }

  confirmTradeOffer() {
    return this._action(() => {
      const phaseError = this._guard([PHASES.TRADE_PENDING]);
      if (phaseError) return phaseError;
      const pending = this.state.pending;
      if (!pending || pending.type !== 'TRADE' || pending.stage !== 'offer') {
        return this._fail('Tidak ada penawaran yang menunggu konfirmasi pengirim.');
      }
      pending.stage = 'confirmation';
      addLog(this.state, 'TRADE', 'Penawaran dikirim; penerima harus menyetujui.', {
        playerId: pending.proposal.toId
      });
      return {
        ok: true,
        stage: 'confirmation',
        summary: summarizeTrade(this.state, this.data, this.profile, pending.proposal),
        phase: this.state.phase
      };
    });
  }

  acceptTrade() {
    return this._action(() => {
      const phaseError = this._guard([PHASES.TRADE_PENDING]);
      if (phaseError) return phaseError;
      const pending = this.state.pending;
      if (!pending || pending.type !== 'TRADE' || pending.stage !== 'confirmation') {
        return this._fail('Penawaran belum siap diterima.');
      }
      const result = executeTrade(this.state, this.data, this.profile, pending.proposal);
      if (!result.ok) return result;
      const resumePhase = pending.resumePhase;
      this.state.pending = null;
      this.state.phase = resumePhase;
      return { ok: true, phase: this.state.phase };
    });
  }

  rejectTrade(reason = 'Penawaran ditolak.') {
    return this._action(() => {
      const phaseError = this._guard([PHASES.TRADE_PENDING]);
      if (phaseError) return phaseError;
      const pending = this.state.pending;
      if (!pending || pending.type !== 'TRADE') return this._fail('Tidak ada penawaran aktif.');
      const resumePhase = pending.resumePhase;
      this.state.pending = null;
      this.state.phase = resumePhase;
      addLog(this.state, 'TRADE', reason);
      return { ok: true, phase: this.state.phase };
    });
  }

  updateSettings(partial) {
    this.state.settings = { ...this.state.settings, ...partial };
    return { ok: true, settings: this.state.settings };
  }
}
