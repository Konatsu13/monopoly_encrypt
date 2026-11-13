/**
 * Data-driven 40-space board. Cells are created once; update() only patches
 * tokens, ownership, buildings, and the current-space highlight.
 */

import { el, mount, sleep } from './dom.js';
import { icon, tokenIcon } from './icons.js';
import { formatMoney } from '../utils/formatters.js';
import { buildDicePair, phaseLabel, playerNumber, spaceCipher, typeMeta } from './presenters.js';

const SPECIAL_BAND = {
  GO: '#f4b860',
  JAIL: '#ff7080',
  GO_TO_JAIL: '#ff7080',
  FREE_PARKING: '#6ee7a8',
  CHANCE: '#4ee1d1',
  COMMUNITY_CHEST: '#a98bff',
  TAX: '#f4b860'
};

function gridPosition(index) {
  if (index === 0) return { row: 11, column: 11 };
  if (index < 10) return { row: 11, column: 11 - index };
  if (index === 10) return { row: 11, column: 1 };
  if (index < 20) return { row: 21 - index, column: 1 };
  if (index === 20) return { row: 1, column: 1 };
  if (index < 30) return { row: 1, column: index - 19 };
  if (index === 30) return { row: 1, column: 11 };
  return { row: index - 29, column: 11 };
}

function phaseHint(phase) {
  switch (phase) {
    case 'WAITING_FOR_ROLL':
      return 'Lempar dadu untuk bergerak.';
    case 'END_TURN':
      return 'Selesaikan giliran dari panel tindakan.';
    case 'PLAYER_DECISION':
      return 'Keputusan pembelian sedang menunggu.';
    case 'CARD_DECRYPTION':
      return 'Kartu terenkripsi menunggu dekripsi.';
    case 'AUCTION':
      return 'Lelang properti sedang berlangsung.';
    case 'DEBT_RESOLUTION':
      return 'Kewajiban finansial harus diselesaikan.';
    case 'JAIL_DECISION':
      return 'Pilih cara keluar dari Pusat Detensi.';
    case 'TRADE_PENDING':
      return 'Penawaran pertukaran sedang berlangsung.';
    case 'GAME_OVER':
      return 'Permainan selesai.';
    default:
      return 'Menyelesaikan tindakan…';
  }
}

export function createBoard(app) {
  const { data, cipher } = app;
  const frame = el('div', { class: 'board-frame' });
  const board = el('div', {
    class: 'board',
    role: 'grid',
    'aria-label': 'Papan Monopoli Cryptonia 40 petak'
  });

  const cellRefs = new Map();
  const tokenRefs = new Map();

  for (const space of data.spaces) {
    const { row, column } = gridPosition(space.index);
    const meta = typeMeta(space.type);
    const property = data.propertiesBySpaceId[space.id];
    const group = property?.group ? data.groups[property.group] : null;
    const bandColor = property ? group?.color : SPECIAL_BAND[space.type];

    const cell = el('button', {
      type: 'button',
      class: `space${space.index % 10 === 0 ? ' is-corner' : ''}`,
      style: { gridRow: String(row), gridColumn: String(column) },
      dataset: { spaceId: space.id, spaceIndex: String(space.index) },
      'aria-label': `Petak ${String(space.index).padStart(2, '0')}, ${meta.label}, nama terenkripsi`,
      title: `Petak ${String(space.index).padStart(2, '0')} — ${meta.label}`,
      onClick: () => app.showSpaceInspector(space.id)
    });

    if (bandColor) cell.appendChild(el('span', { class: 'space-band', style: { background: bandColor }, 'aria-hidden': 'true' }));

    const top = el('div', { class: 'space-top' });
    top.appendChild(el('span', { class: 'space-index', text: String(space.index).padStart(2, '0') }));
    top.appendChild(el('span', { class: 'space-type-icon', 'aria-hidden': 'true' }, icon(meta.icon, { size: 9 })));
    cell.appendChild(top);

    cell.appendChild(el('span', { class: 'space-name', text: spaceCipher(cipher, space) }));

    if (property) {
      cell.appendChild(el('span', { class: 'space-price', text: formatMoney(property.price, data.profile.currency) }));
    } else if (space.type === 'TAX') {
      cell.appendChild(el('span', { class: 'space-price', text: formatMoney(space.taxAmount, data.profile.currency) }));
    } else if (space.index % 10 === 0) {
      cell.appendChild(el('span', { class: 'space-sub', text: meta.label }));
    }

    const houses = el('div', { class: 'houses', 'aria-hidden': 'true' });
    const tokens = el('div', { class: 'space-tokens', 'aria-label': 'Token pemain' });
    cell.appendChild(houses);
    cell.appendChild(tokens);

    if (space.index % 10 === 0) {
      cell.appendChild(el('span', { class: 'space-corner-mark', 'aria-hidden': 'true' }, icon(meta.icon, { size: 20 })));
    }

    board.appendChild(cell);
    cellRefs.set(space.id, { cell, houses, tokens, space });
  }

  // Center console --------------------------------------------------------
  const center = el('div', { class: 'board-center' });
  const content = el('div', { class: 'center-content' });
  content.appendChild(el('p', { class: 'center-eyebrow', text: 'CRYPTONIA / ARSIP 2099' }));
  content.appendChild(el('h2', { class: 'center-title', text: 'THE LOST CIPHER' }));
  content.appendChild(el('p', { class: 'center-year', text: 'TAHUN 2099' }));
  content.appendChild(el('div', { class: 'center-divider' }));

  const turnWrap = el('div', { class: 'center-turn' });
  turnWrap.appendChild(el('span', { class: 'center-turn-label', text: 'GILIRAN SAAT INI' }));
  const turnName = el('span', { class: 'center-turn-name', text: '—' });
  turnWrap.appendChild(turnName);
  content.appendChild(turnWrap);

  const diceWrap = el('div', { class: 'dice-pair' });
  content.appendChild(diceWrap);

  const rollButton = el(
    'button',
    { class: 'btn btn-primary center-roll', type: 'button', onClick: () => app.doRoll() },
    icon('dice', { size: 15 }),
    el('span', { class: 'roll-label', text: 'Lempar Dadu' })
  );
  content.appendChild(rollButton);

  const hint = el('p', { class: 'center-hint', text: 'Lempar dadu untuk bergerak.' });
  content.appendChild(hint);

  const formula = el('p', {
    class: 'center-formula',
    text: cipher.formulas.decryption
  });
  content.appendChild(formula);

  center.appendChild(content);
  board.appendChild(center);

  mount(frame, board);

  function ensureToken(player) {
    let token = tokenRefs.get(player.id);
    if (!token) {
      token = el(
        'span',
        {
          class: 'token',
          style: { '--token-color': player.tokenColor },
          title: player.name,
          'aria-label': `Token ${player.name}`
        },
        el('span', { class: 'icon', html: tokenIcon(player.tokenIcon, { size: 12 }) })
      );
      tokenRefs.set(player.id, token);
    }
    token.style.setProperty('--token-color', player.tokenColor);
    token.title = player.name;
    token.setAttribute('aria-label', `Token ${player.name}`);
    return token;
  }

  function placeToken(player, { animate = false } = {}) {
    const token = ensureToken(player);
    const ref = cellRefs.get(player.position >= 0 ? data.spacesByIndex[player.position]?.id : null);
    if (!ref) return;
    if (token.parentElement !== ref.tokens) ref.tokens.appendChild(token);
    token.classList.toggle('is-current', app.engine?.currentPlayer?.id === player.id);
    if (animate) {
      token.classList.remove('token-hop');
      void token.offsetWidth;
      token.classList.add('token-hop');
    }
  }

  function update(state) {
    if (!state) return;
    const current = state.players[state.currentPlayerIndex];

    for (const { cell, houses, tokens, space } of cellRefs.values()) {
      const property = state.properties[space.id];
      const def = data.propertiesBySpaceId[space.id];
      const isCurrent = current && current.position === space.index;
      cell.classList.toggle('is-current', Boolean(isCurrent));
      cell.classList.toggle('is-owned', Boolean(property?.ownerId));

      // Owner badge
      const oldOwner = cell.querySelector('.space-owner');
      if (oldOwner) oldOwner.remove();
      if (property?.ownerId) {
        const owner = state.players.find((player) => player.id === property.ownerId);
        if (owner) {
          const badge = el('span', {
            class: 'space-owner',
            style: { background: owner.tokenColor },
            text: String(playerNumber(state, owner.id)),
            title: `Dimiliki ${owner.name}`,
            'aria-label': `Dimiliki ${owner.name}`
          });
          cell.appendChild(badge);
        }
      }

      // Mortgage overlay
      const oldMortgage = cell.querySelector('.space-mortgage');
      if (oldMortgage) oldMortgage.remove();
      const oldTag = cell.querySelector('.space-mortgage-tag');
      if (oldTag) oldTag.remove();
      if (property?.mortgaged) {
        cell.appendChild(el('span', { class: 'space-mortgage', 'aria-hidden': 'true' }));
        cell.appendChild(el('span', { class: 'space-mortgage-tag', text: 'GADAI' }));
      }

      // Buildings
      houses.replaceChildren();
      if (property && def?.kind === 'STREET') {
        if (property.hotel) {
          houses.appendChild(el('span', { class: 'hotel', title: 'Hotel' }));
        } else {
          for (let index = 0; index < property.houses; index += 1) {
            houses.appendChild(el('span', { class: 'house', title: 'Rumah' }));
          }
        }
      }

      // Update aria label with ownership (no plaintext names of spaces).
      const meta = typeMeta(space.type);
      const ownerText = property?.ownerId
        ? `, dimiliki investor ${playerNumber(state, property.ownerId)}`
        : '';
      cell.setAttribute(
        'aria-label',
        `Petak ${String(space.index).padStart(2, '0')}, ${meta.label}${ownerText}${property?.mortgaged ? ', digadaikan' : ''}`
      );
      tokens.setAttribute('aria-label', `Token pada petak ${space.index}`);
    }

    // Remove tokens for bankrupt players.
    for (const [playerId, token] of tokenRefs.entries()) {
      const player = state.players.find((candidate) => candidate.id === playerId);
      if (!player || player.bankrupt) token.remove();
    }
    for (const player of state.players) {
      if (player.bankrupt) continue;
      placeToken(player);
    }

    // Center console
    if (current) {
      turnName.replaceChildren();
      const token = el(
        'span',
        { class: 'token-inline', style: { color: current.tokenColor, '--token-color': current.tokenColor } },
        el('span', { class: 'icon', html: tokenIcon(current.tokenIcon, { size: 13 }) })
      );
      turnName.appendChild(token);
      turnName.appendChild(document.createTextNode(current.name));
    } else {
      turnName.textContent = '—';
    }

    const d1 = state.lastDice?.d1 ?? 1;
    const d2 = state.lastDice?.d2 ?? 1;
    mount(diceWrap, buildDicePair(d1, d2));

    const canRoll = state.phase === 'WAITING_FOR_ROLL' && !app.busy;
    rollButton.disabled = !canRoll;
    rollButton.querySelector('.roll-label').textContent = canRoll ? 'Lempar Dadu' : 'Menunggu…';
    hint.textContent = phaseHint(state.phase);
    board.classList.toggle('is-busy', app.busy);
  }

  async function animateMove(move, { reducedMotion = false } = {}) {
    if (!move || reducedMotion) return;
    const player = app.engine?.state?.players.find((candidate) => candidate.id === move.playerId);
    if (!player) return;
    const token = ensureToken(player);
    const path = Array.isArray(move.path) && move.path.length > 0 ? move.path : [move.to];
    // Long card moves are sampled so a turn never waits on a long animation.
    let steps = path;
    let delay = 105;
    if (path.length > 14) {
      const stride = Math.ceil(path.length / 12);
      steps = path.filter((_, index) => index % stride === 0 || index === path.length - 1);
      delay = 70;
    }
    board.classList.add('is-busy');
    for (const index of steps) {
      const space = data.spacesByIndex[index];
      const ref = space ? cellRefs.get(space.id) : null;
      if (!ref) continue;
      ref.tokens.appendChild(token);
      token.classList.remove('token-hop');
      void token.offsetWidth;
      token.classList.add('token-hop');
      await sleep(delay);
    }
    board.classList.remove('is-busy');
  }

  function setBusy(busy) {
    board.classList.toggle('is-busy', Boolean(busy));
  }

  return {
    root: frame,
    board,
    update,
    animateMove,
    setBusy,
    getCell(spaceId) {
      return cellRefs.get(spaceId)?.cell ?? null;
    }
  };
}
