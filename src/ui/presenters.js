/** Shared presentation helpers. Keeps ciphertext handling consistent across UI. */

import { el } from './dom.js';
import { icon, tokenIcon } from './icons.js';
import { formatMoney } from '../utils/formatters.js';
import { wrapCiphertext } from '../utils/formatters.js';

const TYPE_META = {
  GO: { label: 'Gerbang Kota', icon: 'go' },
  PROPERTY: { label: 'Properti', icon: 'house' },
  RAILROAD: { label: 'Stasiun', icon: 'train' },
  UTILITY: { label: 'Utilitas', icon: 'bolt' },
  CHANCE: { label: 'Sinyal Kesempatan', icon: 'signal' },
  COMMUNITY_CHEST: { label: 'Arsip Kota', icon: 'archive' },
  TAX: { label: 'Pajak', icon: 'tax' },
  JAIL: { label: 'Pusat Detensi', icon: 'jail' },
  GO_TO_JAIL: { label: 'Gerbang Penjara', icon: 'jail' },
  FREE_PARKING: { label: 'Taman Netral', icon: 'parking' }
};

const PHASE_LABELS = {
  WAITING_FOR_ROLL: 'Menunggu dadu',
  RESOLVING_SPACE: 'Menyelesaikan petak',
  PLAYER_DECISION: 'Keputusan pembelian',
  CARD_DECRYPTION: 'Dekripsi kartu',
  AUCTION: 'Lelang',
  DEBT_RESOLUTION: 'Penyelesaian utang',
  JAIL_DECISION: 'Keputusan penjara',
  TRADE_PENDING: 'Pertukaran',
  END_TURN: 'Akhir giliran',
  GAME_OVER: 'Permainan selesai'
};

export function typeMeta(type) {
  return TYPE_META[type] ?? { label: type, icon: 'card' };
}

export function phaseLabel(phase) {
  return PHASE_LABELS[phase] ?? phase;
}

export function playerNumber(state, playerId) {
  const index = state.players.findIndex((player) => player.id === playerId);
  return index >= 0 ? index + 1 : null;
}

export function getOwner(state, ownerId) {
  return state.players.find((player) => player.id === ownerId) ?? null;
}

export function cipherTextOf(cipher, text) {
  try {
    return cipher.encryptText(text);
  } catch {
    return '—';
  }
}

export function spaceCipher(cipher, space) {
  return cipherTextOf(cipher, space.name);
}

/** Ciphertext block. `plaintext` is only passed when the caller may reveal it. */
export function buildCipherBlock(cipher, plaintext, { label = 'TEKS TERENKRIPSI', compact = false, maxLine = 38 } = {}) {
  const text = cipherTextOf(cipher, plaintext);
  const block = el('div', { class: `cipher-block${compact ? ' is-compact' : ''}` });
  if (label) block.appendChild(el('span', { class: 'cipher-label', text: label }));
  const lines = wrapCiphertext(text, maxLine);
  for (const line of lines) block.appendChild(el('span', { class: 'cipher-line', text: line }));
  if (lines.length === 0) block.appendChild(el('span', { class: 'cipher-line', text: '—' }));
  return block;
}

export function buildStat(label, value, className = '') {
  const stat = el('dl', { class: 'stat' });
  stat.appendChild(el('dt', { text: label }));
  stat.appendChild(el('dd', { class: className, text: value }));
  return stat;
}

export function buildStatGrid(items) {
  const grid = el('dl', { class: 'stat-grid' });
  for (const item of items) grid.appendChild(buildStat(item.label, item.value, item.className));
  return grid;
}

export function buildGroupChip(data, group) {
  const meta = data.groups[group];
  if (!meta) return el('span', { class: 'group-chip', text: group });
  return el(
    'span',
    { class: 'group-chip' },
    el('i', { style: { '--group-color': meta.color }, 'aria-hidden': 'true' }),
    el('span', { text: meta.label })
  );
}

export function buildPlayerToken(player, { size = 18, className = '' } = {}) {
  return el(
    'span',
    {
      class: `player-token ${className}`.trim(),
      style: { '--token-color': player.tokenColor },
      title: player.name,
      'aria-label': `Token ${player.name}`
    },
    el('span', { class: 'icon', html: tokenIcon(player.tokenIcon, { size }) })
  );
}

export function propertyDefinition(data, spaceId) {
  return data.propertiesBySpaceId[spaceId] ?? null;
}

export function propertyState(state, spaceId) {
  return state.properties[spaceId] ?? null;
}

export function ownershipText(state, propertyStateValue) {
  if (!propertyStateValue?.ownerId) return 'Tanpa pemilik';
  return getOwner(state, propertyStateValue.ownerId)?.name ?? 'Pemilik tidak dikenal';
}

/** Human-readable type + numeric values. Never includes plaintext names. */
export function buildSpaceFacts(app, space) {
  const { data, cipher, engine } = app;
  const state = engine?.state;
  const property = propertyDefinition(data, space.id);
  const pstate = state ? propertyState(state, space.id) : null;
  const items = [];

  if (property) {
    items.push({ label: 'Harga', value: formatMoney(property.price, data.profile.currency), className: 'is-gold' });
    items.push({
      label: 'Nilai gadai',
      value: formatMoney(property.mortgageValue, data.profile.currency)
    });
    if (property.kind === 'STREET') {
      items.push({ label: 'Biaya rumah', value: formatMoney(property.houseCost, data.profile.currency) });
    }
  }
  if (space.type === 'TAX') {
    items.push({ label: 'Nilai pajak', value: formatMoney(space.taxAmount, data.profile.currency), className: 'is-gold' });
  }
  if (pstate) {
    items.push({ label: 'Pemilik', value: ownershipText(state, pstate) });
    items.push({
      label: 'Bangunan',
      value: pstate.hotel ? '1 hotel' : `${pstate.houses} rumah`,
      className: pstate.hotel ? 'is-gold' : ''
    });
    if (pstate.mortgaged) items.push({ label: 'Status', value: 'Digadaikan', className: 'is-danger' });
  }
  items.push({ label: 'Indeks', value: String(space.index).padStart(2, '0') });
  return buildStatGrid(items);
}

export function buildRentTable(data, property, pstate, currency) {
  if (!property || property.kind !== 'STREET') return null;
  const labels = ['Dasar', '1 rumah', '2 rumah', '3 rumah', '4 rumah', 'Hotel'];
  const activeLevel = pstate?.hotel ? 5 : pstate?.houses ?? 0;
  const table = el('table', { class: 'rent-table' });
  const thead = el('thead');
  const headRow = el('tr');
  headRow.appendChild(el('th', { text: 'Tingkat' }));
  headRow.appendChild(el('th', { text: 'Sewa' }));
  thead.appendChild(headRow);
  table.appendChild(thead);
  const tbody = el('tbody');
  property.rent.forEach((amount, index) => {
    const row = el('tr', { class: index === activeLevel ? 'is-active' : '' });
    row.appendChild(el('td', { text: labels[index] }));
    row.appendChild(el('td', { text: formatMoney(amount, currency) }));
    tbody.appendChild(row);
  });
  table.appendChild(tbody);
  return table;
}

/** Full identity panel used by the inspector and purchase dialog. */
export function buildSpaceIdentity(app, space, { compact = false } = {}) {
  const { cipher, data, engine } = app;
  const reveal = Boolean(engine?.state?.settings?.showBoardPlaintext);
  const meta = typeMeta(space.type);
  const wrap = el('div', { class: 'dialog-stack' });
  const heading = el('div', { class: 'row-between' });
  heading.appendChild(
    el(
      'span',
      { class: 'badge badge-accent' },
      icon(meta.icon, { size: 12 }),
      el('span', { text: meta.label })
    )
  );
  if (space.type === 'PROPERTY' && space.propertyId) {
    const property = propertyDefinition(data, space.id);
    if (property) heading.appendChild(buildGroupChip(data, property.group));
  }
  wrap.appendChild(heading);
  wrap.appendChild(buildCipherBlock(cipher, space.name, { compact, maxLine: compact ? 34 : 42 }));
  if (reveal) {
    wrap.appendChild(
      el(
        'div',
        { class: 'reveal-block' },
        el('span', { class: 'reveal-label', text: 'TEKS ASLI (PENGATURAN AKTIF)' }),
        el('p', { text: space.name })
      )
    );
  }
  return wrap;
}

export function buildDicePair(d1, d2, { rolling = false } = {}) {
  const pair = el('div', { class: 'dice-pair', 'aria-label': `Dadu ${d1} dan ${d2}` });
  for (const value of [d1, d2]) pair.appendChild(buildDie(value, rolling));
  return pair;
}

const PIP_LAYOUTS = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8]
};

export function buildDie(value, rolling = false) {
  const die = el('div', { class: `die${rolling ? ' is-rolling' : ''}`, 'aria-label': `Nilai dadu ${value}` });
  const on = new Set(PIP_LAYOUTS[value] ?? []);
  for (let index = 0; index < 9; index += 1) {
    die.appendChild(el('span', { class: `die-pip${on.has(index) ? ' is-on' : ''}` }));
  }
  return die;
}

export function buildProgressBar(value, max, { tone = 'accent' } = {}) {
  const wrap = el('div', {
    class: 'loading-bar',
    role: 'progressbar',
    'aria-valuemin': '0',
    'aria-valuemax': String(max),
    'aria-valuenow': String(Math.min(value, max)),
    style: { margin: '0' }
  });
  const bar = el('span', { style: { width: `${Math.max(0, Math.min(100, (value / max) * 100))}%` } });
  if (tone === 'danger') bar.style.background = 'linear-gradient(90deg, #ff7080, #f4b860)';
  if (tone === 'ok') bar.style.background = 'linear-gradient(90deg, #6ee7a8, #4ee1d1)';
  wrap.appendChild(bar);
  return wrap;
}
