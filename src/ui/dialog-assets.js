/** Asset management dialog: build, sell, mortgage, unmortgage. */

import { el, mount } from './dom.js';
import { openModal, closeModal, getActiveModal } from './modal.js';
import { icon } from './icons.js';
import { formatMoney } from '../utils/formatters.js';
import { buildCipherBlock, buildGroupChip, getOwner, typeMeta } from './presenters.js';
import { getOwnedProperties } from '../core/game-state.js';

function actionButton(label, status, onClick, extraClass = '') {
  return el(
    'button',
    {
      class: `btn ${extraClass}`.trim(),
      type: 'button',
      disabled: !status.ok,
      title: status.ok ? '' : status.reason,
      onClick
    },
    label
  );
}

export function buildAssetManager(app, playerId, { context = 'assets' } = {}) {
  const state = app.engine.state;
  const player = state.players.find((candidate) => candidate.id === playerId);
  const currency = app.data.profile.currency;
  const wrap = el('div', { class: 'dialog-stack' });

  if (!player) return el('p', { class: 'muted', text: 'Pemain tidak ditemukan.' });

  const summary = el('div', { class: 'row-between' });
  summary.appendChild(el('span', { class: 'tiny muted', text: 'Saldo saat ini' }));
  summary.appendChild(el('strong', { class: 'mono gold-text', text: formatMoney(player.cash, currency) }));
  wrap.appendChild(summary);

  if (app.confirm && app.confirm.context === context) {
    const bar = el('div', { class: 'confirm-bar' });
    bar.appendChild(el('p', { text: app.confirm.message }));
    const row = el('div', { class: 'btn-row' });
    row.appendChild(
      el(
        'button',
        { class: 'btn btn-danger', type: 'button', onClick: () => app.runConfirm() },
        el('span', { text: 'Ya, lanjutkan' })
      )
    );
    row.appendChild(
      el('button', { class: 'btn btn-secondary', type: 'button', onClick: () => app.cancelConfirm() }, el('span', { text: 'Batal' }))
    );
    bar.appendChild(row);
    wrap.appendChild(bar);
  }

  const owned = getOwnedProperties(state, app.data, player.id);
  if (owned.length === 0) {
    wrap.appendChild(el('div', { class: 'asset-empty', text: 'Belum ada properti yang dimiliki.' }));
    return wrap;
  }

  const list = el('div', { class: 'asset-list' });
  for (const property of owned) {
    const space = app.data.spacesById[property.spaceId];
    const def = app.data.propertiesBySpaceId[property.spaceId];
    if (!space || !def) continue;
    const meta = typeMeta(space.type);
    const card = el('div', { class: 'asset-card' });

    const head = el('div', { class: 'asset-head' });
    const left = el('div', { class: 'stack', style: { gap: '3px' } });
    left.appendChild(
      el(
        'span',
        { class: 'row', style: { gap: '6px' } },
        el('span', { class: 'badge', text: `PETAK ${String(space.index).padStart(2, '0')}` }),
        el('span', { class: 'badge badge-accent' }, icon(meta.icon, { size: 11 }), el('span', { text: meta.label }))
      )
    );
    left.appendChild(buildCipherBlock(app.cipher, space.name, { compact: true, label: '', maxLine: 30 }));
    head.appendChild(left);
    card.appendChild(head);

    const metaRow = el('div', { class: 'asset-meta' });
    if (def.kind === 'STREET') metaRow.appendChild(buildGroupChip(app.data, def.group));
    metaRow.appendChild(el('span', { text: `Harga ${formatMoney(def.price, currency)}` }));
    metaRow.appendChild(el('span', { text: `Gadai ${formatMoney(def.mortgageValue, currency)}` }));
    if (def.kind === 'STREET') {
      metaRow.appendChild(
        el('span', {
          text: property.hotel ? '1 hotel' : `${property.houses} rumah`
        })
      );
    }
    if (property.mortgaged) metaRow.appendChild(el('span', { class: 'danger-text', text: 'DIGADAIKAN' }));
    card.appendChild(metaRow);

    const actions = el('div', { class: 'asset-actions' });
    if (def.kind === 'STREET') {
      const buildStatus = app.engine.getBuildStatus(space.id);
      actions.appendChild(
        actionButton(
          buildStatus.ok
            ? buildStatus.willUpgradeToHotel
              ? `Bangun hotel (${formatMoney(buildStatus.cost, currency)})`
              : `Bangun rumah (${formatMoney(buildStatus.cost, currency)})`
            : 'Bangun',
          buildStatus,
          () =>
            app.perform(() => app.engine.build(space.id), {
              successMessage: `Bangunan dibangun di petak ${space.index}.`
            }),
          'btn-secondary'
        )
      );

      const sellStatus = app.engine.getSellStatus(space.id);
      actions.appendChild(
        actionButton(
          sellStatus.ok ? `Jual bangunan (+${formatMoney(sellStatus.saleValue, currency)})` : 'Jual bangunan',
          sellStatus,
          () =>
            app.requestConfirm({
              context,
              message: `Jual bangunan di petak ${space.index}? Tindakan ini tidak dapat dibatalkan.`,
              action: () =>
                app.perform(() => app.engine.sellBuilding(space.id), {
                  successMessage: `Bangunan di petak ${space.index} dijual.`
                })
            })
        )
      );
    }

    if (!property.mortgaged) {
      const mortgageStatus = app.engine.getMortgageStatus(space.id);
      actions.appendChild(
        actionButton(
          mortgageStatus.ok ? `Gadai (+${formatMoney(mortgageStatus.value, currency)})` : 'Gadai',
          mortgageStatus,
          () =>
            app.requestConfirm({
              context,
              message: `Gadaikan petak ${space.index}? Properti tidak menghasilkan sewa sampai ditebus.`,
              action: () =>
                app.perform(() => app.engine.mortgage(space.id), {
                  successMessage: `Petak ${space.index} digadaikan.`
                })
            }),
          'btn-danger'
        )
      );
    } else {
      const unmortgageStatus = app.engine.getUnmortgageStatus(space.id);
      actions.appendChild(
        actionButton(
          unmortgageStatus.ok ? `Tebus (${formatMoney(unmortgageStatus.cost, currency)})` : 'Tebus gadai',
          unmortgageStatus,
          () =>
            app.perform(() => app.engine.unmortgage(space.id), {
              successMessage: `Petak ${space.index} ditebus.`
            }),
          'btn-primary'
        )
      );
    }

    card.appendChild(actions);
    list.appendChild(card);
  }

  wrap.appendChild(list);
  wrap.appendChild(
    el('p', {
      class: 'tiny faint',
      text: 'Bangunan harus dibangun dan dijual merata dalam satu grup warna. Properti yang digadaikan tidak menghasilkan sewa.'
    })
  );
  return wrap;
}

export function openAssets(app) {
  if (!app.engine) return;
  const player = app.engine.currentPlayer;
  if (!player) return;
  if (getActiveModal()?.key === 'assets') {
    app.refreshDialog();
    return;
  }
  app.confirm = null;
  openModal({
    key: 'assets',
    kicker: 'LEDGER ASET',
    title: 'Kelola Aset',
    subtitle: `${player.name} · ${formatMoney(player.cash, app.data.profile.currency)}`,
    dismissible: true,
    wide: true,
    content: buildAssetManager(app, player.id, { context: 'assets' }),
    onClose: () => {
      app.confirm = null;
      closeModal({ silent: true, force: true });
    }
  });
}

export function refreshAssetsDialog(app) {
  const active = getActiveModal();
  if (active?.key !== 'assets' || !app.engine) return;
  const player = app.engine.currentPlayer;
  if (!player) return;
  app.updateDialogContent(buildAssetManager(app, player.id, { context: 'assets' }));
}

export { getOwner };
