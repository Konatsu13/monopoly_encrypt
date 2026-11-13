/** Header, player list, action panel, and activity log renderers. */

import { el, mount } from './dom.js';
import { icon } from './icons.js';
import { formatMoney } from '../utils/formatters.js';
import {
  buildCipherBlock,
  buildPlayerToken,
  cipherTextOf,
  phaseLabel,
  playerNumber,
  typeMeta
} from './presenters.js';
import {
  calculateNetWorth,
  countBuildings,
  getOwnedProperties
} from '../core/game-state.js';

const LOG_LABELS = {
  SYSTEM: 'SYS',
  TURN: 'TRN',
  DICE: 'DADU',
  MOVE: 'MOV',
  PROPERTY: 'PROP',
  RENT: 'SEWA',
  TAX: 'PAJAK',
  MONEY: 'UANG',
  CARD: 'KARTU',
  CARDS: 'DEK',
  JAIL: 'TAHAN',
  DEBT: 'UTANG',
  AUCTION: 'LELANG',
  TRADE: 'TUKAR',
  GAME_OVER: 'AKHIR'
};

export function renderHeader(app) {
  const state = app.engine?.state;
  const player = app.engine?.currentPlayer;
  const headerPlayer = document.getElementById('header-player');
  const headerTurn = document.getElementById('header-turn-number');
  const headerKey = document.getElementById('header-key');

  if (!state) return;
  if (headerPlayer) {
    headerPlayer.textContent = player ? player.name : '—';
    headerPlayer.style.color = player?.tokenColor ?? '';
  }
  if (headerTurn) {
    headerTurn.textContent = `Turn ${state.turnNumber} · ${phaseLabel(state.phase)}`;
  }
  if (headerKey) {
    headerKey.textContent = `${state.encryptionKeyId}${state.encryptionConfig.approved ? '' : ' · DEMO'}`;
  }
}

export function renderSaveStatus(app) {
  const node = document.getElementById('header-save');
  if (!node) return;
  if (app.saveState === 'error') {
    node.className = 'save-chip is-error';
    node.textContent = 'Gagal menyimpan';
    node.title = app.saveError ?? '';
    return;
  }
  if (app.saveState === 'saved') {
    node.className = 'save-chip is-saved';
    node.textContent = 'Tersimpan lokal';
    node.title = app.lastSavedAt ? `Terakhir: ${app.lastSavedAt}` : '';
    return;
  }
  node.className = 'save-chip';
  node.textContent = 'Belum disimpan';
  node.title = '';
}

export function renderPlayers(app) {
  const list = document.getElementById('players-list');
  const bank = document.getElementById('players-bank');
  const supply = document.getElementById('players-bank-supply');
  if (!list || !app.engine) return;
  const state = app.engine.state;
  const current = app.engine.currentPlayer;

  if (bank) bank.textContent = `${state.players.filter((player) => !player.bankrupt).length} aktif`;
  if (supply) {
    mount(
      supply,
      el('span', { text: `Bank: ${state.bank.houses} rumah` }),
      el('span', { text: `${state.bank.hotels} hotel` }),
      el('span', { text: `${state.stats.turnsPlayed} giliran selesai` })
    );
  }

  mount(
    list,
    state.players.map((player) => {
      const owned = getOwnedProperties(state, app.data, player.id);
      const buildings = countBuildings(state, app.data, player.id);
      const isCurrent = current?.id === player.id;
      const card = el('article', {
        class: `player-card${isCurrent ? ' is-current' : ''}${player.bankrupt ? ' is-bankrupt' : ''}`,
        'aria-label': `${player.name}, ${formatMoney(player.cash, app.data.profile.currency)}${
          isCurrent ? ', giliran saat ini' : ''
        }${player.bankrupt ? ', bangkrut' : ''}`
      });
      card.appendChild(buildPlayerToken(player, { size: 17 }));
      const main = el('div', { class: 'player-main' });
      const top = el('div', { class: 'player-top' });
      top.appendChild(el('span', { class: 'player-name', text: player.name }));
      top.appendChild(el('span', { class: 'player-cash', text: formatMoney(player.cash, app.data.profile.currency) }));
      main.appendChild(top);

      const meta = el('div', { class: 'player-meta' });
      meta.appendChild(el('span', { text: `P${playerNumber(state, player.id)}` }));
      meta.appendChild(el('span', { text: `Petak ${String(player.position).padStart(2, '0')}` }));
      meta.appendChild(el('span', { text: `${owned.length} aset` }));
      if (player.jailFreeCardIds.length > 0) {
        meta.appendChild(el('span', { class: 'is-warn', text: `${player.jailFreeCardIds.length} kartu bebas` }));
      }
      main.appendChild(meta);

      const badges = el('div', { class: 'player-badges' });
      if (isCurrent) badges.appendChild(el('span', { class: 'badge badge-accent', text: 'GILIRAN' }));
      if (player.inJail) badges.appendChild(el('span', { class: 'badge badge-danger', text: 'DITAHAN' }));
      if (buildings.houses > 0 || buildings.hotels > 0) {
        badges.appendChild(
          el('span', {
            class: 'badge',
            text: `${buildings.houses}R · ${buildings.hotels}H`
          })
        );
      }
      if (player.bankrupt) badges.appendChild(el('span', { class: 'badge badge-danger', text: 'BANGKRUT' }));
      if (badges.children.length > 0) main.appendChild(badges);

      card.appendChild(main);
      return card;
    })
  );
}

function actionStats(app, player) {
  const state = app.engine.state;
  const owned = getOwnedProperties(state, app.data, player.id);
  const net = calculateNetWorth(state, app.data, player.id);
  const grid = el('dl', { class: 'action-stats' });
  const items = [
    ['Saldo', formatMoney(player.cash, app.data.profile.currency)],
    ['Kekayaan', formatMoney(net, app.data.profile.currency)],
    ['Aset', `${owned.length} properti`],
    ['Posisi', `Petak ${String(player.position).padStart(2, '0')}`]
  ];
  for (const [label, value] of items) {
    const stat = el('dl', { class: 'action-stat' });
    stat.appendChild(el('dt', { text: label }));
    stat.appendChild(el('dd', { text: value }));
    grid.appendChild(stat);
  }
  return grid;
}

function currentSpaceBlock(app, player) {
  const space = app.data.spacesByIndex[player.position];
  if (!space) return null;
  const meta = typeMeta(space.type);
  const wrap = el('div', { class: 'action-cipher' });
  wrap.appendChild(el('span', { class: 'action-cipher-label', text: `${meta.label.toUpperCase()} · PETAK ${String(space.index).padStart(2, '0')}` }));
  wrap.appendChild(document.createTextNode(cipherTextOf(app.cipher, space.name)));
  return wrap;
}

function decisionButton(app, label, onClick, { variant = 'secondary', disabled = false, title = '' } = {}) {
  return el(
    'button',
    {
      class: `btn btn-${variant}${disabled ? '' : ''}`,
      type: 'button',
      disabled,
      title: disabled ? title || 'Aksi belum tersedia pada fase ini.' : title,
      onClick
    },
    label
  );
}

export function renderAction(app) {
  const body = document.getElementById('action-body');
  const phaseBadge = document.getElementById('action-phase');
  if (!body || !app.engine) return;
  const state = app.engine.state;
  const player = app.engine.currentPlayer;
  if (phaseBadge) {
    phaseBadge.textContent = phaseLabel(state.phase);
    phaseBadge.className = 'badge badge-accent';
  }
  if (!player) {
    mount(body, el('p', { class: 'muted', text: 'Tidak ada pemain aktif.' }));
    return;
  }

  const content = [];
  const assetsAllowed = ['WAITING_FOR_ROLL', 'END_TURN', 'DEBT_RESOLUTION'].includes(state.phase);
  const tradeAllowed = ['WAITING_FOR_ROLL', 'END_TURN'].includes(state.phase) && state.players.filter((p) => !p.bankrupt).length > 1;
  const utilityRow = el('div', { class: 'btn-row' });
  utilityRow.appendChild(
    decisionButton(app, 'Kelola Aset', () => app.openAssets(), {
      disabled: !assetsAllowed,
      title: 'Aset hanya dapat dikelola saat giliran berjalan atau saat menyelesaikan utang.'
    })
  );
  utilityRow.appendChild(
    decisionButton(app, 'Pertukaran', () => app.openTrade(), {
      disabled: !tradeAllowed,
      title: 'Pertukaran hanya dapat diajukan pada fase menunggu dadu atau akhir giliran.'
    })
  );

  switch (state.phase) {
    case 'WAITING_FOR_ROLL': {
      content.push(
        el('p', { class: 'action-lead' }, 'Giliran ', el('strong', { text: player.name }), '. Lempar dadu untuk bergerak.')
      );
      content.push(actionStats(app, player));
      const spaceBlock = currentSpaceBlock(app, player);
      if (spaceBlock) content.push(spaceBlock);
      content.push(
        el(
          'button',
          { class: 'btn btn-primary btn-block', type: 'button', onClick: () => app.doRoll() },
          icon('dice', { size: 16 }),
          el('span', { text: 'Lempar Dadu' })
        )
      );
      if (player.doublesCount > 0) {
        content.push(el('p', { class: 'action-note', text: 'Dadu ganda: setelah petak selesai, Anda mendapat lemparan tambahan.' }));
      }
      break;
    }
    case 'END_TURN': {
      content.push(el('p', { class: 'action-lead' }, 'Giliran ', el('strong', { text: player.name }), ' siap diakhiri.'));
      content.push(actionStats(app, player));
      content.push(
        el(
          'button',
          { class: 'btn btn-primary btn-block', type: 'button', onClick: () => app.doEndTurn() },
          icon('chevronRight', { size: 16 }),
          el('span', { text: 'Akhiri Giliran' })
        )
      );
      break;
    }
    case 'PLAYER_DECISION': {
      const pending = state.pending;
      const space = pending ? app.data.spacesById[pending.spaceId] : null;
      const def = pending ? app.data.propertiesBySpaceId[pending.spaceId] : null;
      content.push(el('p', { class: 'action-lead', text: 'Properti tanpa pemilik sedang ditawarkan.' }));
      if (space && def) {
        const meta = typeMeta(space.type);
        content.push(el('p', { class: 'action-note', text: `${meta.label} · Petak ${String(space.index).padStart(2, '0')}` }));
        content.push(buildCipherBlock(app.cipher, space.name, { compact: true, maxLine: 30 }));
        content.push(
          el('p', {
            class: 'action-note',
            text: `Harga ${formatMoney(def.price, app.data.profile.currency)} · Saldo ${formatMoney(
              player.cash,
              app.data.profile.currency
            )}`
          })
        );
        const row = el('div', { class: 'btn-row' });
        row.appendChild(
          decisionButton(app, 'Beli', () => app.doBuy(), {
            variant: 'primary',
            disabled: player.cash < def.price,
            title: 'Saldo tidak cukup untuk membeli properti ini.'
          })
        );
        row.appendChild(decisionButton(app, 'Tolak & Lelang', () => app.doDecline(), { variant: 'secondary' }));
        content.push(row);
      }
      break;
    }
    case 'CARD_DECRYPTION': {
      content.push(el('p', { class: 'action-lead', text: 'Kartu terenkripsi menunggu dekripsi manual.' }));
      content.push(el('p', { class: 'action-note', text: 'Efek kartu tidak akan dijalankan sebelum jawaban dekripsi benar.' }));
      content.push(
        el(
          'button',
          { class: 'btn btn-primary btn-block', type: 'button', onClick: () => app.reopenRequiredDialog() },
          el('span', { text: 'Buka Panel Dekripsi' })
        )
      );
      break;
    }
    case 'AUCTION': {
      const auction = state.pending;
      const bidder = auction ? state.players.find((candidate) => candidate.id === auction.currentBidderId) : null;
      content.push(el('p', { class: 'action-lead', text: 'Lelang properti sedang berlangsung.' }));
      content.push(
        el('p', {
          class: 'action-note',
          text: auction
            ? `Penawaran tertinggi ${formatMoney(auction.currentBid, app.data.profile.currency)} · Giliran ${bidder?.name ?? '—'}`
            : 'Data lelang tidak tersedia.'
        })
      );
      content.push(
        el(
          'button',
          { class: 'btn btn-primary btn-block', type: 'button', onClick: () => app.reopenRequiredDialog() },
          el('span', { text: 'Buka Panel Lelang' })
        )
      );
      break;
    }
    case 'DEBT_RESOLUTION': {
      const pending = state.pending;
      const debtor = pending ? state.players.find((candidate) => candidate.id === pending.debtorId) : player;
      content.push(el('p', { class: 'action-lead', text: 'Kewajiban finansial belum terpenuhi.' }));
      content.push(
        el('p', {
          class: 'action-note',
          text: pending
            ? `${debtor?.name ?? 'Investor'} harus membayar ${formatMoney(
                pending.amount,
                app.data.profile.currency
              )}. Saldo: ${formatMoney(debtor?.cash ?? 0, app.data.profile.currency)}.`
            : 'Data utang tidak tersedia.'
        })
      );
      content.push(
        el(
          'button',
          { class: 'btn btn-primary btn-block', type: 'button', onClick: () => app.reopenRequiredDialog() },
          el('span', { text: 'Buka Panel Utang' })
        )
      );
      break;
    }
    case 'JAIL_DECISION': {
      content.push(el('p', { class: 'action-lead' }, el('strong', { text: player.name }), ' ditahan di Pusat Detensi.'));
      content.push(
        el('p', {
          class: 'action-note',
          text: `Percobaan ${player.jailTurns} dari ${app.data.profile.jailMaxTurns}. Denda ${formatMoney(
            app.data.profile.jailFine,
            app.data.profile.currency
          )}.`
        })
      );
      content.push(
        el(
          'button',
          { class: 'btn btn-primary btn-block', type: 'button', onClick: () => app.reopenRequiredDialog() },
          el('span', { text: 'Buka Opsi Penjara' })
        )
      );
      break;
    }
    case 'TRADE_PENDING': {
      content.push(el('p', { class: 'action-lead', text: 'Penawaran pertukaran sedang menunggu konfirmasi.' }));
      content.push(
        el(
          'button',
          { class: 'btn btn-primary btn-block', type: 'button', onClick: () => app.reopenRequiredDialog() },
          el('span', { text: 'Buka Panel Pertukaran' })
        )
      );
      break;
    }
    case 'GAME_OVER': {
      content.push(el('p', { class: 'action-lead', text: 'Permainan telah selesai.' }));
      content.push(
        el(
          'button',
          { class: 'btn btn-primary btn-block', type: 'button', onClick: () => app.reopenRequiredDialog() },
          el('span', { text: 'Lihat Hasil Akhir' })
        )
      );
      break;
    }
    default: {
      content.push(el('p', { class: 'action-lead', text: 'Menyelesaikan tindakan…' }));
      content.push(el('p', { class: 'action-note', text: 'Tunggu hingga fase permainan berpindah.' }));
    }
  }

  content.push(utilityRow);
  mount(body, content);
}

export function renderLog(app) {
  const list = document.getElementById('log-list');
  const count = document.getElementById('log-count');
  if (!list || !app.engine) return;
  const state = app.engine.state;
  if (count) count.textContent = `${state.log.length} catatan`;
  const entries = state.log.slice(-60).reverse();
  if (entries.length === 0) {
    mount(list, el('li', { class: 'log-empty', text: 'Belum ada catatan.' }));
    return;
  }
  mount(
    list,
    entries.map((entry) =>
      el(
        'li',
        { class: 'log-entry', dataset: { category: entry.category } },
        el('span', { class: 'log-cat', text: LOG_LABELS[entry.category] ?? entry.category }),
        el('span', { text: entry.message })
      )
    )
  );
}

export function renderGame(app) {
  renderHeader(app);
  renderSaveStatus(app);
  renderPlayers(app);
  renderAction(app);
  renderLog(app);
  app.board?.update(app.engine.state);
}
