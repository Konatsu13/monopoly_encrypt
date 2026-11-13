/** Trade builder and two-party confirmation dialog. */

import { el, mount } from './dom.js';
import { openModal, closeModal } from './modal.js';
import { formatMoney } from '../utils/formatters.js';
import { buildCipherBlock, buildGroupChip, typeMeta } from './presenters.js';
import { getOwnedProperties } from '../core/game-state.js';
import { hasBuildingsAnywhereInGroup } from '../core/property-engine.js';

function otherPlayers(app) {
  const state = app.engine.state;
  return state.players.filter((player) => !player.bankrupt && player.id !== app.engine.currentPlayer?.id);
}

function defaultDraft(app) {
  const partner = otherPlayers(app)[0];
  return {
    toId: partner?.id ?? '',
    fromProperties: [],
    toProperties: [],
    fromCash: 0,
    toCash: 0,
    fromJailCards: 0,
    toJailCards: 0
  };
}

function normalizeDraft(app) {
  const valid = otherPlayers(app).some((player) => player.id === app.tradeDraft?.toId);
  if (!app.tradeDraft || !valid) app.tradeDraft = defaultDraft(app);
  return app.tradeDraft;
}

function propertyChecklist(app, player, selected, onToggle) {
  const state = app.engine.state;
  const list = el('div', { class: 'trade-list' });
  const owned = getOwnedProperties(state, app.data, player.id);
  if (owned.length === 0) {
    list.appendChild(el('p', { class: 'tiny faint', text: 'Tidak ada properti.' }));
    return list;
  }
  for (const property of owned) {
    const space = app.data.spacesById[property.spaceId];
    const def = app.data.propertiesBySpaceId[property.spaceId];
    if (!space || !def) continue;
    const blocked = def.kind === 'STREET' && hasBuildingsAnywhereInGroup(state, app.data, def.group);
    const label = el('label', { class: `trade-item${blocked ? ' is-disabled' : ''}` });
    const checkbox = el('input', {
      type: 'checkbox',
      checked: selected.includes(space.id),
      disabled: blocked,
      onChange: (event) => onToggle(space.id, event.target.checked)
    });
    label.appendChild(checkbox);
    const text = el('span');
    text.appendChild(
      el('span', {
        text: `${String(space.index).padStart(2, '0')} · ${app.cipher.encryptText(space.name)}`
      })
    );
    const meta = [];
    meta.push(typeMeta(space.type).label);
    if (def.kind === 'STREET') meta.push(app.data.groups[def.group]?.label ?? def.group);
    meta.push(formatMoney(def.price, app.data.profile.currency));
    if (blocked) meta.push('jual bangunan dahulu');
    text.appendChild(el('span', { class: 'tiny', text: meta.join(' · ') }));
    label.appendChild(text);
    list.appendChild(label);
  }
  return list;
}

function builderContent(app) {
  const draft = normalizeDraft(app);
  const state = app.engine.state;
  const from = app.engine.currentPlayer;
  const to = state.players.find((player) => player.id === draft.toId);
  if (!from || !to) return el('p', { class: 'muted', text: 'Tidak ada partner pertukaran yang tersedia.' });

  const wrap = el('div', { class: 'dialog-stack' });

  const partnerField = el('div', { class: 'field' });
  partnerField.appendChild(el('label', { for: 'trade-partner', text: 'Partner pertukaran' }));
  const select = el('select', {
    id: 'trade-partner',
    class: 'select',
    onChange: (event) => {
      draft.toId = event.target.value;
      draft.toProperties = [];
      draft.toCash = 0;
      draft.toJailCards = 0;
      app.refreshDialog();
    }
  });
  for (const player of otherPlayers(app)) {
    select.appendChild(
      el('option', {
        value: player.id,
        text: `${player.name} — ${formatMoney(player.cash, app.data.profile.currency)}`,
        selected: player.id === draft.toId
      })
    );
  }
  partnerField.appendChild(select);
  wrap.appendChild(partnerField);

  const grid = el('div', { class: 'trade-grid' });

  const fromSide = el('div', { class: 'trade-side' });
  fromSide.appendChild(el('h3', { text: `${from.name} memberi` }));
  fromSide.appendChild(
    propertyChecklist(app, from, draft.fromProperties, (spaceId, checked) => {
      if (checked) draft.fromProperties.push(spaceId);
      else draft.fromProperties = draft.fromProperties.filter((id) => id !== spaceId);
    })
  );
  const fromCashField = el('div', { class: 'field' });
  fromCashField.appendChild(el('label', { for: 'trade-from-cash', text: `Uang dari ${from.name}` }));
  fromCashField.appendChild(
    el('input', {
      id: 'trade-from-cash',
      class: 'input input-mono',
      type: 'number',
      min: '0',
      step: '1',
      max: String(from.cash),
      value: String(draft.fromCash),
      disabled: draft.toCash > 0,
      onChange: (event) => {
        draft.fromCash = Math.max(0, Math.min(from.cash, Math.floor(Number(event.target.value) || 0)));
        if (draft.fromCash > 0) draft.toCash = 0;
        app.refreshDialog();
      }
    })
  );
  fromSide.appendChild(fromCashField);
  if (from.jailFreeCardIds.length > 0) {
    const cardsField = el('div', { class: 'field' });
    cardsField.appendChild(el('label', { for: 'trade-from-cards', text: `Kartu bebas penjara (${from.jailFreeCardIds.length})` }));
    cardsField.appendChild(
      el('input', {
        id: 'trade-from-cards',
        class: 'input input-mono',
        type: 'number',
        min: '0',
        max: String(from.jailFreeCardIds.length),
        value: String(draft.fromJailCards),
        onChange: (event) => {
          draft.fromJailCards = Math.max(
            0,
            Math.min(from.jailFreeCardIds.length, Math.floor(Number(event.target.value) || 0))
          );
        }
      })
    );
    fromSide.appendChild(cardsField);
  }
  grid.appendChild(fromSide);

  const toSide = el('div', { class: 'trade-side' });
  toSide.appendChild(el('h3', { text: `${to.name} memberi` }));
  toSide.appendChild(
    propertyChecklist(app, to, draft.toProperties, (spaceId, checked) => {
      if (checked) draft.toProperties.push(spaceId);
      else draft.toProperties = draft.toProperties.filter((id) => id !== spaceId);
    })
  );
  const toCashField = el('div', { class: 'field' });
  toCashField.appendChild(el('label', { for: 'trade-to-cash', text: `Uang dari ${to.name}` }));
  toCashField.appendChild(
    el('input', {
      id: 'trade-to-cash',
      class: 'input input-mono',
      type: 'number',
      min: '0',
      step: '1',
      max: String(to.cash),
      value: String(draft.toCash),
      disabled: draft.fromCash > 0,
      onChange: (event) => {
        draft.toCash = Math.max(0, Math.min(to.cash, Math.floor(Number(event.target.value) || 0)));
        if (draft.toCash > 0) draft.fromCash = 0;
        app.refreshDialog();
      }
    })
  );
  toSide.appendChild(toCashField);
  if (to.jailFreeCardIds.length > 0) {
    const cardsField = el('div', { class: 'field' });
    cardsField.appendChild(el('label', { for: 'trade-to-cards', text: `Kartu bebas penjara (${to.jailFreeCardIds.length})` }));
    cardsField.appendChild(
      el('input', {
        id: 'trade-to-cards',
        class: 'input input-mono',
        type: 'number',
        min: '0',
        max: String(to.jailFreeCardIds.length),
        value: String(draft.toJailCards),
        onChange: (event) => {
          draft.toJailCards = Math.max(
            0,
            Math.min(to.jailFreeCardIds.length, Math.floor(Number(event.target.value) || 0))
          );
        }
      })
    );
    toSide.appendChild(cardsField);
  }
  grid.appendChild(toSide);
  wrap.appendChild(grid);

  wrap.appendChild(
    el('p', {
      class: 'tiny faint',
      text: 'Uang hanya boleh berasal dari satu sisi. Properti dalam grup yang masih memiliki bangunan tidak dapat diperdagangkan.'
    })
  );

  const actions = el('div', { class: 'dialog-actions' });
  actions.appendChild(
    el(
      'button',
      { class: 'btn btn-primary', type: 'button', onClick: () => app.proposeTrade(draft) },
      el('span', { text: 'Ajukan Pertukaran' })
    )
  );
  actions.appendChild(
    el('button', { class: 'btn btn-secondary', type: 'button', onClick: () => app.closeTrade() }, el('span', { text: 'Batal' }))
  );
  wrap.appendChild(actions);
  return wrap;
}

function summaryRow(app, side, directionLabel) {
  const row = el('div', { class: 'trade-summary-row' });
  const left = el('div');
  left.appendChild(el('strong', { text: side.player?.name ?? '—' }));
  left.appendChild(
    el('p', {
      class: 'tiny muted',
      text: `${directionLabel}: ${formatMoney(side.cash, app.data.profile.currency)}${
        side.cards > 0 ? ` · ${side.cards} kartu bebas` : ''
      }`
    })
  );
  row.appendChild(left);
  row.appendChild(el('span', { class: 'arrow', text: '⇄' }));
  const right = el('div');
  if (side.properties.length === 0) {
    right.appendChild(el('span', { class: 'tiny faint', text: 'Tanpa properti' }));
  } else {
    for (const space of side.properties) {
      right.appendChild(
        el('div', {
          class: 'tiny mono',
          text: `${String(space.index).padStart(2, '0')} · ${app.cipher.encryptText(space.name)}`
        })
      );
    }
  }
  row.appendChild(right);
  return row;
}

function summaryContent(app, proposal) {
  const state = app.engine.state;
  const from = state.players.find((player) => player.id === proposal.fromId);
  const to = state.players.find((player) => player.id === proposal.toId);
  const wrap = el('div', { class: 'dialog-stack' });

  const rows = el('div', { class: 'trade-summary' });
  rows.appendChild(summaryRow(app, {
    player: from,
    cash: proposal.fromCash ?? 0,
    cards: proposal.fromJailCards ?? 0,
    properties: (proposal.fromProperties ?? []).map((spaceId) => app.data.spacesById[spaceId]).filter(Boolean)
  }, 'Memberi'));
  rows.appendChild(summaryRow(app, {
    player: to,
    cash: proposal.toCash ?? 0,
    cards: proposal.toJailCards ?? 0,
    properties: (proposal.toProperties ?? []).map((spaceId) => app.data.spacesById[spaceId]).filter(Boolean)
  }, 'Memberi'));
  wrap.appendChild(rows);

  const stage = state.pending?.stage;
  if (stage === 'offer') {
    wrap.appendChild(
      el('div', { class: 'info-box' }, el('p', {
        text: 'Penawar harus mengonfirmasi penawaran terlebih dahulu. Setelah itu perangkat diserahkan kepada penerima untuk menerima atau menolak.'
      }))
    );
    const actions = el('div', { class: 'dialog-actions' });
    actions.appendChild(
      el(
        'button',
        { class: 'btn btn-primary', type: 'button', onClick: () => app.confirmTradeOffer() },
        el('span', { text: 'Konfirmasi & Kirim ke Penerima' })
      )
    );
    actions.appendChild(
      el(
        'button',
        { class: 'btn btn-secondary', type: 'button', onClick: () => app.rejectTrade('Penawaran dibatalkan oleh pengirim.') },
        el('span', { text: 'Batalkan' })
      )
    );
    wrap.appendChild(actions);
  } else {
    wrap.appendChild(
      el('div', { class: 'warning-box' }, el('p', {
        text: `Serahkan perangkat kepada ${to?.name ?? 'penerima'}. Hanya penerima yang boleh menekan tombol Terima.`
      }))
    );
    const actions = el('div', { class: 'dialog-actions' });
    actions.appendChild(
      el(
        'button',
        { class: 'btn btn-primary', type: 'button', onClick: () => app.acceptTrade() },
        el('span', { text: 'Terima Pertukaran' })
      )
    );
    actions.appendChild(
      el(
        'button',
        { class: 'btn btn-danger', type: 'button', onClick: () => app.rejectTrade('Penawaran ditolak oleh penerima.') },
        el('span', { text: 'Tolak' })
      )
    );
    wrap.appendChild(actions);
  }
  return wrap;
}

export function tradeDialogContent(app) {
  const state = app.engine.state;
  if (state.pending?.type === 'TRADE') {
    return summaryContent(app, state.pending.proposal);
  }
  return builderContent(app);
}

export function openTrade(app) {
  if (!app.engine) return;
  if (!['WAITING_FOR_ROLL', 'END_TURN'].includes(app.engine.state.phase)) return;
  app.tradeDraft = defaultDraft(app);
  openModal({
    key: 'trade',
    kicker: 'PERTUKARAN ASET',
    title: 'Ajukan Pertukaran',
    subtitle: 'Kedua pihak harus menyetujui sebelum aset berpindah.',
    dismissible: true,
    wide: true,
    content: tradeDialogContent(app),
    onClose: () => {
      app.tradeDraft = null;
      if (app.engine?.state.pending?.type === 'TRADE') {
        app.engine.rejectTrade('Penawaran ditutup.');
        app.refresh();
      }
    }
  });
}

export function refreshTradeDialog(app) {
  app.updateDialogContent(tradeDialogContent(app));
}

export { closeModal, buildCipherBlock, buildGroupChip };
