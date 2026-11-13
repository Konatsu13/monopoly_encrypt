/**
 * Application orchestration.
 *
 * The app owns screen navigation, the active engine, autosave, and the
 * relationship between engine actions and UI refreshes. All game mutations
 * still happen inside GameEngine; this file only sequences them.
 */

import { GameEngine } from './core/game-engine.js';
import { DEFAULT_SETTINGS, MAX_PLAYERS, MIN_PLAYERS } from './core/constants.js';
import { normalizePlayerName } from './utils/validators.js';
import {
  clearSave,
  loadGame,
  loadSettings,
  markPrologueSeen,
  saveGame,
  saveSettings
} from './storage/local-save.js';
import { createBoard } from './ui/board.js';
import { renderGame, renderSaveStatus } from './ui/panels.js';
import { closeModal, getActiveModal, updateModal } from './ui/modal.js';
import { showToast } from './ui/toast.js';
import { mount, setHidden } from './ui/dom.js';
import { openRequiredDialog, syncRequiredDialog } from './ui/dialog-game.js';
import {
  openAssets as openAssetsDialog,
  refreshAssetsDialog
} from './ui/dialog-assets.js';
import { openTrade as openTradeDialog, refreshTradeDialog } from './ui/dialog-trade.js';
import {
  openGuide,
  openHelp,
  openIntro,
  openSettings,
  openSpaceInspector,
  refreshSettingsDialog
} from './ui/dialog-info.js';
import { renderMenu, renderPrologue, renderSetup } from './screens.js';

const SCREENS = [
  'screen-loading',
  'screen-fatal',
  'screen-menu',
  'screen-prologue',
  'screen-setup',
  'screen-game'
];

const REQUIRED_DIALOG_KEYS = ['buy', 'card', 'auction', 'debt', 'jail', 'gameover', 'trade'];

function defaultSetupDraft(data) {
  return [
    { name: '', tokenId: data.tokens[0]?.id ?? '' },
    { name: '', tokenId: data.tokens[1]?.id ?? '' }
  ];
}

export class App {
  constructor({ data, cipher, story }) {
    this.data = data;
    this.cipher = cipher;
    this.story = story ?? data.story;

    this.engine = null;
    this.board = null;
    this.busy = false;

    this.settings = { ...DEFAULT_SETTINGS, ...(loadSettings() ?? {}) };
    this.saveState = 'idle';
    this.saveError = null;
    this.lastSavedAt = null;

    this.screen = 'screen-loading';
    this.prologueContext = 'menu';
    this.prologueIndex = 0;

    this.setupDraft = defaultSetupDraft(data);
    this.setupDemo = false;
    this.setupAck = false;
    this.setupError = '';

    this.confirm = null;
    this.tradeDraft = null;
    this.cardFeedback = null;
    this.auctionFeedback = null;
    this.menuSaveResult = null;

    this._bound = false;
  }

  /* ------------------------------------------------------------- Screens */

  showScreen(id) {
    for (const screenId of SCREENS) {
      const node = document.getElementById(screenId);
      if (node) setHidden(node, screenId !== id);
    }
    this.screen = id;
    const heading = document.querySelector(`#${id} h1, #${id} h2`);
    if (heading) {
      heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
    }
  }

  showMenu() {
    closeModal({ force: true });
    this.confirm = null;
    this.tradeDraft = null;
    this.cardFeedback = null;
    this.auctionFeedback = null;
    this.showScreen('screen-menu');
    renderMenu(this);
  }

  startPrologue(context = 'menu') {
    closeModal({ force: true });
    this.prologueContext = context;
    this.prologueIndex = 0;
    this.showScreen('screen-prologue');
    renderPrologue(this);
  }

  prologueNext() {
    const slides = this.story?.prologue?.slides ?? [];
    if (this.prologueIndex >= slides.length - 1) {
      this.finishPrologue();
      return;
    }
    this.prologueIndex += 1;
    renderPrologue(this);
  }

  prologueBack() {
    if (this.prologueIndex <= 0) return;
    this.prologueIndex -= 1;
    renderPrologue(this);
  }

  finishPrologue() {
    markPrologueSeen();
    const context = this.prologueContext;
    if (context === 'new-game' || context === 'setup') {
      this.showSetup();
      return;
    }
    if (context === 'game' && this.engine) {
      this.showScreen('screen-game');
      this.refresh();
      return;
    }
    this.showMenu();
  }

  showSetup() {
    closeModal({ force: true });
    this.showScreen('screen-setup');
    renderSetup(this);
  }

  newGameFlow() {
    this.setupDraft = defaultSetupDraft(this.data);
    this.setupDemo = false;
    this.setupAck = false;
    this.setupError = '';
    this.startPrologue('new-game');
  }

  /* --------------------------------------------------------------- Setup */

  setSetupPlayerName(index, value) {
    if (!this.setupDraft[index]) return;
    this.setupDraft[index].name = value;
    if (this.setupError) this.clearSetupError();
  }

  setSetupPlayerToken(index, tokenId) {
    if (!this.setupDraft[index]) return;
    this.setupDraft[index].tokenId = tokenId;
    this.clearSetupError();
    renderSetup(this);
  }

  setSetupDemo(checked) {
    this.setupDemo = Boolean(checked);
  }

  setSetupAck(checked) {
    this.setupAck = Boolean(checked);
  }

  clearSetupError() {
    this.setupError = '';
    const node = document.getElementById('setup-error');
    if (node) {
      node.textContent = '';
      node.hidden = true;
    }
  }

  addSetupPlayer() {
    if (this.setupDraft.length >= MAX_PLAYERS) {
      this.setSetupError(`Maksimal ${MAX_PLAYERS} investor.`);
      return;
    }
    const used = this.setupDraft.map((player) => player.tokenId);
    const token = this.data.tokens.find((candidate) => !used.includes(candidate.id));
    if (!token) {
      this.setSetupError('Token unik tidak tersedia untuk investor tambahan.');
      return;
    }
    this.setupDraft.push({ name: '', tokenId: token.id });
    this.clearSetupError();
    renderSetup(this);
  }

  removeSetupPlayer(index = this.setupDraft.length - 1) {
    if (this.setupDraft.length <= MIN_PLAYERS) {
      this.setSetupError(`Minimal ${MIN_PLAYERS} investor.`);
      return;
    }
    this.setupDraft.splice(index, 1);
    this.clearSetupError();
    renderSetup(this);
  }

  setSetupError(message) {
    this.setupError = message;
    const node = document.getElementById('setup-error');
    if (node) {
      node.textContent = message;
      node.hidden = false;
    }
  }

  validateSetup() {
    const setup = this.story.setup;
    const names = this.setupDraft.map((player) => String(player.name ?? '').trim());
    if (names.some((name) => name.length === 0)) return setup.invalidNames;

    const normalized = names.map(normalizePlayerName);
    if (new Set(normalized).size !== normalized.length) return setup.duplicateNames;

    const tokens = this.setupDraft.map((player) => player.tokenId);
    if (tokens.some((token) => !token)) return setup.invalidToken;
    if (new Set(tokens).size !== tokens.length) return setup.duplicateTokens;

    const key = this.data.encryptionConfig;
    if (!key.approved && (!this.setupDemo || !this.setupAck)) {
      return 'Kunci pengembangan belum disetujui. Aktifkan mode pengembangan dan centang pernyataan untuk melanjutkan.';
    }
    return null;
  }

  startGame() {
    const validationError = this.validateSetup();
    if (validationError) {
      this.setSetupError(validationError);
      return;
    }

    const players = this.setupDraft.map((player) => ({
      name: player.name.trim(),
      tokenId: player.tokenId
    }));

    let engine;
    try {
      engine = GameEngine.create({
        players,
        data: this.data,
        cipher: this.cipher,
        settings: {
          ...this.settings,
          demoMode: !this.data.encryptionConfig.approved
        }
      });
    } catch (error) {
      this.setSetupError(error.message);
      return;
    }

    this.engine = engine;
    this.cipher = engine.cipher;
    this.settings = { ...this.settings, ...engine.state.settings };
    this.board = null;
    this.busy = false;
    this.confirm = null;
    this.tradeDraft = null;
    this.cardFeedback = null;
    this.auctionFeedback = null;
    this.saveState = 'idle';
    this.lastSavedAt = null;

    closeModal({ force: true });
    this.showScreen('screen-game');
    this.ensureBoard();
    this.refresh();
    this.saveNow();
    showToast('Permainan dimulai. Seluruh nama petak tampil sebagai sandi.', 'success');
    openIntro(this);
  }

  /* ---------------------------------------------------------- Resume flow */

  continueGame() {
    const loaded = loadGame(this.data);
    if (!loaded.ok) {
      showToast(loaded.reason ?? 'Save tidak dapat dimuat.', 'error');
      if (this.screen === 'screen-menu') renderMenu(this);
      return;
    }

    let engine;
    try {
      engine = new GameEngine({ state: loaded.state, data: this.data });
    } catch (error) {
      showToast(`Save tidak dapat dilanjutkan: ${error.message}`, 'error');
      return;
    }

    this.engine = engine;
    this.cipher = engine.cipher;
    this.settings = { ...this.settings, ...engine.state.settings };
    this.board = null;
    this.busy = false;
    this.confirm = null;
    this.tradeDraft = null;
    this.cardFeedback = null;
    this.auctionFeedback = null;
    this.saveState = 'saved';
    this.lastSavedAt = loaded.savedAt ?? null;

    closeModal({ force: true });
    this.showScreen('screen-game');
    this.ensureBoard();
    this.refresh();
    showToast('Permainan dilanjutkan dari save lokal.', 'success');
  }

  ensureBoard() {
    if (!this.engine) return;
    const root = document.getElementById('board-root');
    if (!root) return;
    if (!this.board) {
      this.board = createBoard(this);
      mount(root, this.board.root);
    }
    this.board.update(this.engine.state);
  }

  /* ------------------------------------------------------------- Refresh */

  refresh() {
    if (!this.engine) return;
    renderGame(this);
    syncRequiredDialog(this);
  }

  refreshDialog() {
    const active = getActiveModal();
    if (!active) return;
    switch (active.key) {
      case 'assets':
        refreshAssetsDialog(this);
        break;
      case 'settings':
        refreshSettingsDialog(this);
        break;
      case 'trade':
        refreshTradeDialog(this);
        break;
      default:
        if (REQUIRED_DIALOG_KEYS.includes(active.key)) openRequiredDialog(this);
        break;
    }
  }

  updateDialogContent(content, { title, subtitle } = {}) {
    updateModal({ title, subtitle, content });
  }

  reopenRequiredDialog() {
    if (!this.engine) return;
    openRequiredDialog(this);
  }

  /* --------------------------------------------------------------- Save */

  saveNow() {
    if (!this.engine) return;
    const result = saveGame(this.engine.state);
    if (result.ok) {
      this.saveState = 'saved';
      this.saveError = null;
      this.lastSavedAt = new Date().toISOString();
    } else {
      this.saveState = 'error';
      this.saveError = result.reason;
    }
    renderSaveStatus(this);
  }

  /* ------------------------------------------------------------ Actions */

  async perform(action, { successMessage = null, onFailure = null, animate = true } = {}) {
    if (this.busy) return { ok: false, reason: 'Aksi lain sedang diproses.' };
    if (!this.engine) return { ok: false, reason: 'Permainan belum dimulai.' };

    this.busy = true;
    this.board?.setBusy(true);
    const previousMove = this.engine.state.lastMove;

    let result;
    try {
      result = action();
    } catch (error) {
      result = { ok: false, reason: error.message };
    }

    if (!result || result.ok !== true) {
      this.busy = false;
      this.board?.setBusy(false);
      if (onFailure) onFailure(result ?? { ok: false, reason: 'Aksi gagal.' });
      else showToast(result?.reason ?? 'Aksi gagal.', 'error');
      this.refresh();
      return result ?? { ok: false };
    }

    const currentMove = this.engine.state.lastMove;
    if (animate && currentMove && currentMove !== previousMove) {
      await this.board?.animateMove(currentMove, {
        reducedMotion: Boolean(this.settings.reducedMotion)
      });
    }

    this.busy = false;
    this.board?.setBusy(false);
    this.saveNow();
    this.refresh();
    if (successMessage) {
      showToast(typeof successMessage === 'function' ? successMessage(result) : successMessage, 'success');
    }
    return result;
  }

  doRoll() {
    return this.perform(() => this.engine.roll());
  }

  doEndTurn() {
    return this.perform(() => this.engine.endTurn());
  }

  doBuy() {
    return this.perform(() => this.engine.buyProperty(), {
      successMessage: 'Properti dibeli dan dicatat di ledger kota.'
    });
  }

  doDecline() {
    return this.perform(() => this.engine.declinePurchase(), {
      successMessage: (result) =>
        result.auction ? 'Properti dilelang kepada investor aktif.' : 'Properti tidak dibeli.'
    });
  }

  payDebt() {
    return this.perform(() => this.engine.payDebt(), {
      successMessage: 'Utang dibayar.'
    });
  }

  declareBankruptcy() {
    return this.perform(() => this.engine.declareBankruptcy(), {
      successMessage: (result) =>
        result.gameOver ? 'Permainan selesai.' : 'Kebangkrutan diselesaikan dan aset dipindahkan.'
    });
  }

  jailRoll() {
    return this.perform(() => this.engine.jailRoll());
  }

  jailPayFine() {
    return this.perform(() => this.engine.jailPayFine(), {
      successMessage: (result) => (result.paid ? 'Denda dibayar; pemain keluar dari penjara.' : 'Denda masuk antrean pembayaran.')
    });
  }

  jailUseCard() {
    return this.perform(() => this.engine.jailUseCard(), {
      successMessage: 'Kartu bebas penjara digunakan.'
    });
  }

  async checkCardAnswer(answer) {
    if (this.busy || !this.engine) return { ok: false };
    this.busy = true;
    this.board?.setBusy(true);
    const cardId = this.engine.state.pending?.cardId ?? null;

    let result;
    try {
      result = this.engine.checkCardAnswer(answer);
    } catch (error) {
      result = { ok: false, reason: error.message };
    }

    this.busy = false;
    this.board?.setBusy(false);

    if (!result.ok) {
      showToast(result.reason ?? 'Dekripsi tidak dapat diperiksa.', 'error');
    } else if (!result.correct) {
      this.cardFeedback = {
        cardId,
        type: 'error',
        message: result.message ?? 'Jawaban belum cocok.'
      };
    } else {
      this.cardFeedback = null;
      showToast('Dekripsi benar. Periksa efek terstruktur lalu terapkan.', 'success');
    }

    this.saveNow();
    this.refresh();
    return result;
  }

  applyCard() {
    this.cardFeedback = null;
    return this.perform(() => this.engine.applyPendingCard(), {
      successMessage: 'Efek kartu diterapkan tepat satu kali.'
    });
  }

  useAssistance() {
    return this.perform(() => this.engine.useAssistance(), {
      successMessage: 'Bantuan dekripsi digunakan. Konfirmasi efek secara manual.'
    });
  }

  async auctionBid(amount) {
    this.auctionFeedback = null;
    const result = await this.perform(() => this.engine.auctionBid(amount), {
      onFailure: (failure) => {
        this.auctionFeedback = { type: 'error', message: failure.reason ?? 'Penawaran ditolak.' };
      }
    });
    return result;
  }

  async auctionPass() {
    this.auctionFeedback = null;
    const result = await this.perform(() => this.engine.auctionPass(), {
      onFailure: (failure) => {
        this.auctionFeedback = { type: 'error', message: failure.reason ?? 'Tidak dapat lewat.' };
      }
    });
    return result;
  }

  proposeTrade(draft) {
    const proposal = {
      toId: draft.toId,
      fromProperties: [...(draft.fromProperties ?? [])],
      toProperties: [...(draft.toProperties ?? [])],
      fromCash: Number(draft.fromCash) || 0,
      toCash: Number(draft.toCash) || 0,
      fromJailCards: Number(draft.fromJailCards) || 0,
      toJailCards: Number(draft.toJailCards) || 0
    };
    return this.perform(() => this.engine.proposeTrade(proposal));
  }

  confirmTradeOffer() {
    return this.perform(() => this.engine.confirmTradeOffer(), {
      successMessage: 'Penawaran dikirim. Serahkan perangkat kepada penerima.'
    });
  }

  acceptTrade() {
    this.tradeDraft = null;
    return this.perform(() => this.engine.acceptTrade(), {
      successMessage: 'Pertukaran diterima dan aset berpindah.'
    });
  }

  rejectTrade(reason = 'Penawaran ditolak.') {
    this.tradeDraft = null;
    return this.perform(() => this.engine.rejectTrade(reason), {
      successMessage: reason
    });
  }

  closeTrade() {
    this.tradeDraft = null;
    closeModal({ force: true });
  }

  /* ----------------------------------------------------------- Dialogs */

  openAssets() {
    if (!this.engine) return;
    openAssetsDialog(this);
  }

  openTrade() {
    if (!this.engine) return;
    openTradeDialog(this);
  }

  openHelp() {
    openHelp(this);
  }

  openGuide() {
    openGuide(this);
  }

  openSettings() {
    openSettings(this);
  }

  showSpaceInspector(spaceId) {
    if (!this.engine) return;
    openSpaceInspector(this, spaceId);
  }

  requestConfirm({ context, message, action }) {
    this.confirm = { context, message, action };
    this.refreshDialog();
  }

  async runConfirm() {
    const action = this.confirm?.action;
    this.confirm = null;
    if (action) await action();
    this.refreshDialog();
  }

  cancelConfirm() {
    this.confirm = null;
    this.refreshDialog();
  }

  updateSetting(key, value) {
    this.settings = { ...this.settings, [key]: value };
    saveSettings(this.settings);
    if (this.engine) {
      this.engine.updateSettings({ [key]: value });
      this.saveNow();
    }
    if (this.engine) this.refresh();
    this.refreshDialog();
  }

  replayPrologue() {
    closeModal({ force: true });
    this.startPrologue(this.engine ? 'game' : 'menu');
  }

  clearSaveData() {
    clearSave();
    this.engine = null;
    this.board = null;
    this.saveState = 'idle';
    this.lastSavedAt = null;
    this.saveError = null;
    this.confirm = null;
    closeModal({ force: true });
    this.showMenu();
    showToast('Save lokal dihapus.', 'success');
  }

  playAgain() {
    const previous = this.engine?.state.players ?? [];
    if (previous.length >= MIN_PLAYERS) {
      this.setupDraft = previous.map((player) => ({
        name: player.name,
        tokenId: player.tokenId
      }));
    }
    clearSave();
    this.engine = null;
    this.board = null;
    this.saveState = 'idle';
    this.lastSavedAt = null;
    this.confirm = null;
    this.tradeDraft = null;
    closeModal({ force: true });
    this.setupDemo = false;
    this.setupAck = false;
    this.setupError = '';
    this.showSetup();
  }

  backToMenu() {
    this.saveNow();
    closeModal({ force: true });
    this.confirm = null;
    this.tradeDraft = null;
    this.showMenu();
  }

  /* ----------------------------------------------------------- Controls */

  bindControls() {
    if (this._bound) return;
    this._bound = true;

    document.getElementById('fatal-reload')?.addEventListener('click', () => window.location.reload());
    document.getElementById('prologue-skip')?.addEventListener('click', () => this.finishPrologue());
    document.getElementById('prologue-back')?.addEventListener('click', () => this.prologueBack());
    document.getElementById('prologue-next')?.addEventListener('click', () => this.prologueNext());

    document.getElementById('setup-back')?.addEventListener('click', () => this.showMenu());
    document.getElementById('setup-story')?.addEventListener('click', () => this.startPrologue('setup'));
    document.getElementById('setup-add')?.addEventListener('click', () => this.addSetupPlayer());
    document.getElementById('setup-remove')?.addEventListener('click', () => this.removeSetupPlayer());
    document.getElementById('setup-start')?.addEventListener('click', () => this.startGame());
    document.getElementById('setup-demo')?.addEventListener('change', (event) => this.setSetupDemo(event.target.checked));
    document.getElementById('setup-ack')?.addEventListener('change', (event) => this.setSetupAck(event.target.checked));

    document.getElementById('header-help')?.addEventListener('click', () => this.openHelp());
    document.getElementById('header-guide')?.addEventListener('click', () => this.openGuide());
    document.getElementById('header-settings')?.addEventListener('click', () => this.openSettings());
    document.getElementById('header-menu')?.addEventListener('click', () => this.backToMenu());
  }
}
