/** Required decision dialogs: buy, card decryption, auction, debt, jail, game over. */

import { el, mount } from './dom.js';
import { openModal, closeModal, getActiveModal } from './modal.js';
import { icon } from './icons.js';
import { formatMoney, wrapCiphertext } from '../utils/formatters.js';
import {
  buildCipherBlock,
  buildProgressBar,
  buildSpaceIdentity,
  buildStatGrid,
  getOwner,
  typeMeta
} from './presenters.js';
import { effectSummary } from '../core/card-engine.js';
import { calculateNetWorth, getOwnedProperties } from '../core/game-state.js';
import { buildAssetManager } from './dialog-assets.js';
import { tradeDialogContent } from './dialog-trade.js';

const REQUIRED_KEYS = ['buy', 'card', 'auction', 'debt', 'jail', 'gameover', 'trade'];

export function requiredDialogKey(state) {
  switch (state.phase) {
    case 'PLAYER_DECISION':
      return 'buy';
    case 'CARD_DECRYPTION':
      return 'card';
    case 'AUCTION':
      return 'auction';
    case 'DEBT_RESOLUTION':
      return 'debt';
    case 'JAIL_DECISION':
      return 'jail';
    case 'GAME_OVER':
      return 'gameover';
    case 'TRADE_PENDING':
      return 'trade';
    default:
      return null;
  }
}

function deckLabel(app, deckKey) {
  const storyDeck = app.story?.decks?.[deckKey];
  return storyDeck?.label ?? app.data.decks?.[deckKey]?.label ?? deckKey;
}

function feedbackBox(feedback) {
  if (!feedback) return null;
  const box = el('div', { class: feedback.type === 'error' ? 'danger-box' : 'info-box', role: 'status' });
  box.appendChild(el('p', { text: feedback.message }));
  return box;
}

/* ------------------------------------------------------------------ Buy */
function buyContent(app) {
  const state = app.engine.state;
  const pending = state.pending;
  const space = app.data.spacesById[pending.spaceId];
  const def = app.data.propertiesBySpaceId[pending.spaceId];
  const player = state.players.find((candidate) => candidate.id === pending.playerId);
  if (!space || !def || !player) return el('p', { class: 'muted', text: 'Data pembelian tidak lengkap.' });

  const wrap = el('div', { class: 'dialog-stack' });
  wrap.appendChild(buildSpaceIdentity(app, space));
  wrap.appendChild(
    buildStatGrid([
      { label: 'Harga', value: formatMoney(def.price, app.data.profile.currency), className: 'is-gold' },
      { label: 'Saldo', value: formatMoney(player.cash, app.data.profile.currency) },
      {
        label: 'Sisa setelah beli',
        value: formatMoney(player.cash - def.price, app.data.profile.currency),
        className: player.cash >= def.price ? 'is-ok' : 'is-danger'
      }
    ])
  );
  wrap.appendChild(
    el('div', { class: 'info-box' }, el('p', {
      text: 'Jika Anda menolak, properti akan dilelang kepada semua investor aktif sesuai profil edisi.'
    }))
  );
  const actions = el('div', { class: 'dialog-actions' });
  actions.appendChild(
    el(
      'button',
      {
        class: 'btn btn-primary',
        type: 'button',
        disabled: player.cash < def.price || app.busy,
        title: player.cash < def.price ? 'Saldo tidak cukup.' : '',
        onClick: () => app.doBuy()
      },
      el('span', { text: 'Beli Properti' })
    )
  );
  actions.appendChild(
    el(
      'button',
      { class: 'btn btn-secondary', type: 'button', disabled: app.busy, onClick: () => app.doDecline() },
      el('span', { text: 'Tolak & Lelang' })
    )
  );
  wrap.appendChild(actions);
  return wrap;
}

/* ----------------------------------------------------------------- Card */
function cardContent(app) {
  const state = app.engine.state;
  const pending = state.pending;
  const card = app.data.cardsById[pending.cardId];
  if (!card) return el('p', { class: 'muted', text: 'Data kartu tidak ditemukan.' });
  const deckStory = app.story?.decks?.[pending.deck];
  const currency = app.data.profile.currency;
  const wrap = el('div', { class: 'dialog-stack' });

  const framing = el('div', { class: 'info-box' });
  framing.appendChild(el('p', { class: 'strong', text: deckLabel(app, pending.deck) }));
  if (deckStory?.framing) framing.appendChild(el('p', { text: deckStory.framing }));
  if (deckStory?.instruction) framing.appendChild(el('p', { class: 'tiny muted', text: deckStory.instruction }));
  wrap.appendChild(framing);

  wrap.appendChild(buildCipherBlock(app.cipher, card.plaintext, { label: 'ISI KARTU TERENKRIPSI', maxLine: 36 }));

  const formula = el('div', { class: 'formula-stack' });
  formula.appendChild(el('span', {}, el('span', { class: 'formula-key', text: 'f(x) = ' }), app.cipher.formulas.f.replace(' mod 26', ''), el('span', { text: ' mod 26' })));
  formula.appendChild(el('span', {}, el('span', { class: 'formula-key', text: 'g(x) = ' }), app.cipher.formulas.g.replace(' mod 26', ''), el('span', { text: ' mod 26' })));
  formula.appendChild(el('span', {}, el('span', { class: 'formula-key', text: 'E(x) = ' }), app.cipher.formulas.encryption.replace('E(x) = ', '')));
  formula.appendChild(el('span', {}, el('span', { class: 'formula-key', text: 'E⁻¹(y) = ' }), app.cipher.formulas.decryption.replace('E⁻¹(y) = ', '')));
  wrap.appendChild(formula);

  if (!pending.verified) {
    const feedback = app.cardFeedback?.cardId === card.id ? app.cardFeedback : null;
    if (feedback) wrap.appendChild(feedbackBox(feedback));

    const form = el('form', { class: 'dialog-stack', onSubmit: (event) => {
      event.preventDefault();
      const value = form.querySelector('#card-answer')?.value ?? '';
      app.checkCardAnswer(value);
    } });
    const field = el('div', { class: 'field' });
    field.appendChild(el('label', { for: 'card-answer', text: 'Tulis hasil dekripsi' }));
    field.appendChild(
      el('textarea', {
        id: 'card-answer',
        class: 'textarea',
        rows: '3',
        placeholder: 'Tulis kalimat hasil dekripsi dalam huruf biasa…',
        'data-preserve': 'card-answer',
        'data-autofocus': '',
        spellcheck: 'false',
        autocomplete: 'off'
      })
    );
    field.appendChild(
      el('p', {
        class: 'field-hint',
        text: 'Huruf besar/kecil, spasi, dan tanda baca tidak harus sama persis. Urutan invers fungsi harus benar.'
      })
    );
    form.appendChild(field);
    const submit = el(
      'button',
      { class: 'btn btn-primary btn-block', type: 'submit', disabled: app.busy },
      el('span', { text: 'Periksa Dekripsi' })
    );
    form.appendChild(submit);
    wrap.appendChild(form);

    wrap.appendChild(
      el('p', { class: 'tiny faint', text: `Percobaan: ${pending.attempts}. Efek kartu belum dijalankan.` })
    );

    if (state.settings.assistedMode || state.settings.revealAnswer) {
      const assist = el('div', { class: 'row-between' });
      assist.appendChild(
        el('span', { class: 'tiny muted', text: state.settings.revealAnswer ? 'Mode guru aktif.' : 'Mode bantuan aktif.' })
      );
      assist.appendChild(
        el(
          'button',
          { class: 'btn btn-secondary btn-small', type: 'button', disabled: app.busy, onClick: () => app.useAssistance() },
          el('span', { text: state.settings.revealAnswer ? 'Tampilkan Jawaban' : 'Gunakan Bantuan' })
        )
      );
      wrap.appendChild(assist);
    }
  } else {
    wrap.appendChild(
      el(
        'div',
        { class: 'reveal-block' },
        el('span', { class: 'reveal-label', text: 'DEKRIPSI BERHASIL — ISI KARTU' }),
        el('p', { text: card.plaintext })
      )
    );
    wrap.appendChild(
      el('div', { class: 'info-box' }, el('p', { class: 'strong', text: 'Efek terstruktur' }), el('p', {
        text: effectSummary(card, app.data.profile)
      }))
    );
    wrap.appendChild(
      el('p', {
        class: 'tiny faint',
        text: `Efek belum dijalankan. Konfirmasi untuk menerapkannya tepat satu kali. Percobaan dekripsi: ${pending.attempts}.`
      })
    );
    wrap.appendChild(
      el(
        'button',
        { class: 'btn btn-primary btn-block', type: 'button', disabled: app.busy, onClick: () => app.applyCard() },
        icon('check', { size: 15 }),
        el('span', { text: 'Terapkan Efek Kartu' })
      )
    );
  }

  return wrap;
}

/* --------------------------------------------------------------- Auction */
function auctionContent(app) {
  const state = app.engine.state;
  const auction = state.pending;
  const space = app.data.spacesById[auction.spaceId];
  const def = app.data.propertiesBySpaceId[auction.spaceId];
  const current = state.players.find((player) => player.id === auction.currentBidderId);
  const high = auction.highBidderId ? state.players.find((player) => player.id === auction.highBidderId) : null;
  const currency = app.data.profile.currency;
  const minBid = Math.max(auction.currentBid + auction.minIncrement, auction.minIncrement);
  const wrap = el('div', { class: 'dialog-stack' });

  if (space) wrap.appendChild(buildSpaceIdentity(app, space, { compact: true }));

  wrap.appendChild(
    buildStatGrid([
      { label: 'Penawaran tertinggi', value: formatMoney(auction.currentBid, currency), className: 'is-gold' },
      { label: 'Penawar tertinggi', value: high?.name ?? 'Belum ada' },
      { label: 'Minimum berikutnya', value: formatMoney(minBid, currency) },
      { label: 'Harga dasar', value: def ? formatMoney(def.price, currency) : '—' }
    ])
  );

  if (app.auctionFeedback) wrap.appendChild(feedbackBox(app.auctionFeedback));

  const order = el('div', { class: 'auction-order' });
  for (const id of auction.order) {
    const player = state.players.find((candidate) => candidate.id === id);
    if (!player) continue;
    const active = auction.activeIds.includes(id);
    const isHigh = auction.highBidderId === id;
    const isCurrent = auction.currentBidderId === id;
    const row = el('div', {
      class: `auction-player${isCurrent ? ' is-current' : ''}${isHigh ? ' is-high' : ''}${active ? '' : ' is-out'}`
    });
    row.appendChild(el('span', { text: player.name }));
    const tags = el('div', { class: 'auction-tags' });
    if (isHigh) tags.appendChild(el('span', { class: 'badge badge-warn', text: 'TERTINGGI' }));
    if (isCurrent) tags.appendChild(el('span', { class: 'badge badge-accent', text: 'GILIRAN' }));
    if (!active) tags.appendChild(el('span', { class: 'badge', text: 'LEWAT' }));
    row.appendChild(tags);
    order.appendChild(row);
  }
  wrap.appendChild(order);

  if (current) {
    wrap.appendChild(
      el('p', { class: 'action-note', text: `Giliran menawar: ${current.name}. Saldo ${formatMoney(current.cash, currency)}.` })
    );
    if (current.cash < minBid) {
      wrap.appendChild(
        el('div', { class: 'warning-box' }, el('p', {
          text: 'Saldo tidak cukup untuk penawaran minimum. Pemain ini hanya dapat lewat.'
        }))
      );
    } else {
      const form = el('form', { class: 'dialog-stack', onSubmit: (event) => {
        event.preventDefault();
        const value = Number(form.querySelector('#auction-bid')?.value);
        app.auctionBid(value);
      } });
      const row = el('div', { class: 'bid-row' });
      const field = el('div', { class: 'field' });
      field.appendChild(el('label', { for: 'auction-bid', text: `Penawaran (min. ${formatMoney(minBid, currency)})` }));
      field.appendChild(
        el('input', {
          id: 'auction-bid',
          class: 'input input-mono',
          type: 'number',
          min: String(minBid),
          max: String(current.cash),
          step: '1',
          value: String(minBid),
          'data-preserve': 'auction-bid',
          'data-autofocus': ''
        })
      );
      row.appendChild(field);
      row.appendChild(
        el(
          'button',
          { class: 'btn btn-primary', type: 'submit', disabled: app.busy },
          el('span', { text: 'Tawar' })
        )
      );
      form.appendChild(row);

      const quick = el('div', { class: 'quick-bids' });
      for (const amount of [...new Set([minBid, minBid + 10, minBid + 50])]) {
        if (amount > current.cash) continue;
        quick.appendChild(
          el(
            'button',
            {
              class: 'btn btn-secondary',
              type: 'button',
              disabled: app.busy,
              onClick: () => app.auctionBid(amount)
            },
            el('span', { text: formatMoney(amount, currency) })
          )
        );
      }
      form.appendChild(quick);
      wrap.appendChild(form);
    }

    wrap.appendChild(
      el(
        'button',
        { class: 'btn btn-secondary btn-block', type: 'button', disabled: app.busy, onClick: () => app.auctionPass() },
        el('span', { text: 'Lewati Lelang' })
      )
    );
  }

  wrap.appendChild(
    el('p', { class: 'tiny faint', text: 'Penawar tertinggi menang saat semua peserta lain lewat. Jika semua lewat, properti tetap tanpa pemilik.' })
  );
  return wrap;
}

/* ------------------------------------------------------------------ Debt */
function debtContent(app) {
  const state = app.engine.state;
  const pending = state.pending;
  const debtor = state.players.find((player) => player.id === pending.debtorId);
  const creditor = pending.creditorId ? state.players.find((player) => player.id === pending.creditorId) : null;
  const currency = app.data.profile.currency;
  const wrap = el('div', { class: 'dialog-stack' });
  if (!debtor) return el('p', { class: 'muted', text: 'Debitur tidak ditemukan.' });

  const shortfall = Math.max(0, pending.amount - debtor.cash);
  wrap.appendChild(
    el('div', { class: 'danger-box' }, el('p', { class: 'strong', text: pending.reason }), el('p', {
      text: `${debtor.name} harus membayar ${formatMoney(pending.amount, currency)} kepada ${
        creditor ? creditor.name : 'bank'
      }.`
    }))
  );
  wrap.appendChild(
    buildStatGrid([
      { label: 'Kewajiban', value: formatMoney(pending.amount, currency), className: 'is-danger' },
      { label: 'Saldo', value: formatMoney(debtor.cash, currency), className: 'is-gold' },
      {
        label: shortfall > 0 ? 'Kekurangan' : 'Status',
        value: shortfall > 0 ? formatMoney(shortfall, currency) : 'Cukup untuk membayar',
        className: shortfall > 0 ? 'is-danger' : 'is-ok'
      }
    ])
  );
  wrap.appendChild(buildProgressBar(debtor.cash, pending.amount, { tone: shortfall > 0 ? 'danger' : 'ok' }));
  wrap.appendChild(
    el('p', {
      class: 'tiny muted',
      text: 'Jual bangunan atau gadaikan properti untuk menutup kekurangan. Jika tidak mampu, nyatakan bangkrut; aset akan diselesaikan menurut profil edisi.'
    })
  );

  const actions = el('div', { class: 'dialog-actions' });
  actions.appendChild(
    el(
      'button',
      {
        class: 'btn btn-primary',
        type: 'button',
        disabled: debtor.cash < pending.amount || app.busy,
        title: debtor.cash < pending.amount ? 'Saldo masih kurang.' : '',
        onClick: () => app.payDebt()
      },
      el('span', { text: 'Bayar Utang' })
    )
  );
  actions.appendChild(
    el(
      'button',
      {
        class: 'btn btn-danger',
        type: 'button',
        disabled: debtor.cash >= pending.amount || app.busy,
        title: debtor.cash >= pending.amount ? 'Saldo masih cukup; bayar utang terlebih dahulu.' : '',
        onClick: () =>
          app.requestConfirm({
            context: 'debt-bankruptcy',
            message: `Nyatakan ${debtor.name} bangkrut? Semua aset akan diselesaikan dan pemain keluar dari permainan.`,
            action: () => app.declareBankruptcy()
          })
      },
      el('span', { text: 'Nyatakan Bangkrut' })
    )
  );
  wrap.appendChild(actions);

  if (app.confirm && app.confirm.context === 'debt-bankruptcy') {
    const bar = el('div', { class: 'confirm-bar' });
    bar.appendChild(el('p', { text: app.confirm.message }));
    const row = el('div', { class: 'btn-row' });
    row.appendChild(
      el('button', { class: 'btn btn-danger', type: 'button', onClick: () => app.runConfirm() }, el('span', { text: 'Ya, bangkrut' }))
    );
    row.appendChild(
      el('button', { class: 'btn btn-secondary', type: 'button', onClick: () => app.cancelConfirm() }, el('span', { text: 'Batal' }))
    );
    bar.appendChild(row);
    wrap.appendChild(bar);
  }

  wrap.appendChild(el('div', { class: 'divider' }));
  wrap.appendChild(el('h3', { class: 'field-label', text: 'Kelola aset untuk membayar' }));
  wrap.appendChild(buildAssetManager(app, debtor.id, { context: 'debt-assets' }));
  return wrap;
}

/* ------------------------------------------------------------------ Jail */
function jailContent(app) {
  const state = app.engine.state;
  const player = app.engine.currentPlayer;
  const currency = app.data.profile.currency;
  const wrap = el('div', { class: 'dialog-stack' });
  if (!player) return el('p', { class: 'muted', text: 'Pemain tidak ditemukan.' });

  wrap.appendChild(
    el('div', { class: 'info-box' }, el('p', { class: 'strong', text: app.story?.jail?.title ?? 'Pusat Detensi' }), el('p', {
      text: app.story?.jail?.detained ?? 'Token Anda ditahan.'
    }))
  );
  wrap.appendChild(
    buildStatGrid([
      { label: 'Percobaan', value: `${player.jailTurns} / ${app.data.profile.jailMaxTurns}` },
      { label: 'Denda', value: formatMoney(app.data.profile.jailFine, currency), className: 'is-gold' },
      { label: 'Saldo', value: formatMoney(player.cash, currency) },
      { label: 'Kartu bebas', value: `${player.jailFreeCardIds.length}` }
    ])
  );

  const actions = el('div', { class: 'dialog-actions' });
  actions.appendChild(
    el(
      'button',
      { class: 'btn btn-primary', type: 'button', disabled: app.busy, onClick: () => app.jailRoll() },
      icon('dice', { size: 15 }),
      el('span', { text: 'Lempar Dadu (Ganda)' })
    )
  );
  actions.appendChild(
    el(
      'button',
      { class: 'btn btn-secondary', type: 'button', disabled: app.busy, onClick: () => app.jailPayFine() },
      el('span', { text: `Bayar Denda ${formatMoney(app.data.profile.jailFine, currency)}` })
    )
  );
  if (player.jailFreeCardIds.length > 0) {
    actions.appendChild(
      el(
        'button',
        { class: 'btn btn-secondary', type: 'button', disabled: app.busy, onClick: () => app.jailUseCard() },
        el('span', { text: 'Gunakan Kartu Bebas Penjara' })
      )
    );
  }
  wrap.appendChild(actions);
  wrap.appendChild(
    el('p', {
      class: 'tiny faint',
      text: 'Dadu ganda membebaskan tanpa denda. Pada percobaan terakhir, denda wajib dibayar lalu pemain bergerak.'
    })
  );
  return wrap;
}

/* ------------------------------------------------------------- Game over */
function gameOverContent(app) {
  const state = app.engine.state;
  const currency = app.data.profile.currency;
  const winner = state.winnerId ? state.players.find((player) => player.id === state.winnerId) : null;
  const wrap = el('div', { class: 'dialog-stack' });

  const hero = el('div', { class: 'gameover-hero' });
  hero.appendChild(el('span', { class: 'gameover-crown' }, icon('crown', { size: 34 })));
  hero.appendChild(el('p', { class: 'eyebrow', text: app.story?.winner?.title ?? 'HASIL AKHIR' }));
  hero.appendChild(el('h3', { class: 'gameover-winner', text: winner?.name ?? 'Tidak ada pemenang' }));
  hero.appendChild(
    el('p', { class: 'muted', text: winner ? app.story?.winner?.text ?? '' : app.story?.winner?.neutral ?? '' })
  );
  wrap.appendChild(hero);

  const list = el('div', { class: 'gameover-list' });
  const sorted = [...state.players].sort(
    (a, b) => calculateNetWorth(state, app.data, b.id) - calculateNetWorth(state, app.data, a.id)
  );
  for (const player of sorted) {
    const row = el('div', { class: `gameover-row${player.id === state.winnerId ? ' is-winner' : ''}` });
    row.appendChild(
      el(
        'span',
        { class: 'row', style: { gap: '6px' } },
        el('span', { text: player.name }),
        player.id === state.winnerId ? el('span', { class: 'badge badge-warn', text: 'PEMENANG' }) : null
      )
    );
    row.appendChild(el('span', { class: 'money', text: formatMoney(calculateNetWorth(state, app.data, player.id), currency) }));
    row.appendChild(
      el('span', {
        class: 'status',
        text: player.bankrupt ? 'BANGKRUT' : `${getOwnedProperties(state, app.data, player.id).length} aset`
      })
    );
    list.appendChild(row);
  }
  wrap.appendChild(list);

  wrap.appendChild(
    buildStatGrid([
      { label: 'Giliran', value: String(state.stats.turnsPlayed) },
      { label: 'Lemparan', value: String(state.stats.rolls) },
      { label: 'Kartu didekripsi', value: String(state.stats.cardsDecoded) },
      { label: 'Percobaan gagal', value: String(state.stats.failedDecodeAttempts) }
    ])
  );

  const actions = el('div', { class: 'dialog-actions' });
  actions.appendChild(
    el(
      'button',
      { class: 'btn btn-primary', type: 'button', onClick: () => app.playAgain() },
      el('span', { text: 'Main Lagi' })
    )
  );
  actions.appendChild(
    el('button', { class: 'btn btn-secondary', type: 'button', onClick: () => app.backToMenu() }, el('span', { text: 'Kembali ke Menu' }))
  );
  wrap.appendChild(actions);
  return wrap;
}

/* ------------------------------------------------------------- Descriptor */
function describe(app, key) {
  const state = app.engine.state;
  switch (key) {
    case 'buy': {
      const pending = state.pending;
      const space = app.data.spacesById[pending.spaceId];
      return {
        key,
        kicker: 'KEPUTUSAN PEMBELIAN',
        title: 'Beli properti ini?',
        subtitle: space ? `Petak ${String(space.index).padStart(2, '0')} · ${typeMeta(space.type).label}` : '',
        dismissible: false,
        content: buyContent(app)
      };
    }
    case 'card': {
      const pending = state.pending;
      return {
        key,
        kicker: 'DEKRIPSI KARTU',
        title: 'Kartu Terenkripsi',
        subtitle: deckLabel(app, pending.deck),
        dismissible: false,
        wide: true,
        content: cardContent(app)
      };
    }
    case 'auction': {
      const pending = state.pending;
      const space = app.data.spacesById[pending.spaceId];
      return {
        key,
        kicker: 'LELANG PROPERTI',
        title: 'Lelang Properti',
        subtitle: space ? `Petak ${String(space.index).padStart(2, '0')}` : '',
        dismissible: false,
        wide: true,
        content: auctionContent(app)
      };
    }
    case 'debt': {
      const pending = state.pending;
      const debtor = state.players.find((player) => player.id === pending.debtorId);
      return {
        key,
        kicker: 'PENYELESAIAN UTANG',
        title: app.story?.bankruptcy?.title ?? 'Kewajiban Tidak Terpenuhi',
        subtitle: debtor ? debtor.name : '',
        dismissible: false,
        wide: true,
        content: debtContent(app)
      };
    }
    case 'jail': {
      const player = app.engine.currentPlayer;
      return {
        key,
        kicker: 'PUSAT DETENSI',
        title: app.story?.jail?.title ?? 'Pusat Detensi Cryptonia',
        subtitle: player?.name ?? '',
        dismissible: false,
        content: jailContent(app)
      };
    }
    case 'gameover': {
      return {
        key,
        kicker: 'HASIL AKHIR',
        title: 'Permainan Selesai',
        subtitle: 'Pemenang dihitung oleh mesin permainan.',
        dismissible: false,
        wide: true,
        content: gameOverContent(app)
      };
    }
    case 'trade': {
      const stage = state.pending?.stage;
      return {
        key,
        kicker: 'PERTUKARAN ASET',
        title: stage === 'offer' ? 'Konfirmasi Penawaran' : 'Keputusan Penerima',
        subtitle: 'Kedua pihak harus menyetujui sebelum aset berpindah.',
        dismissible: stage === 'offer',
        wide: true,
        content: tradeDialogContent(app),
        onClose: () => {
          app.tradeDraft = null;
          if (app.engine?.state.pending?.type === 'TRADE') {
            app.engine.rejectTrade('Penawaran ditutup.');
            app.refresh();
          }
        }
      };
    }
    default:
      return null;
  }
}

export function syncRequiredDialog(app) {
  if (!app.engine) return;
  const key = requiredDialogKey(app.engine.state);
  const active = getActiveModal();

  if (!key) {
    if (active && REQUIRED_KEYS.includes(active.key)) closeModal({ force: true });
    return;
  }

  if (active && active.key === key) {
    const descriptor = describe(app, key);
    app.updateDialogContent(descriptor.content, {
      title: descriptor.title,
      subtitle: descriptor.subtitle
    });
    return;
  }

  if (active && !REQUIRED_KEYS.includes(active.key)) {
    closeModal({ force: true });
  }

  const descriptor = describe(app, key);
  if (!descriptor) return;
  openModal(descriptor);
}

export function openRequiredDialog(app) {
  const key = requiredDialogKey(app.engine.state);
  if (!key) return;
  const descriptor = describe(app, key);
  if (!descriptor) return;
  if (getActiveModal()?.key === key) {
    app.updateDialogContent(descriptor.content, { title: descriptor.title, subtitle: descriptor.subtitle });
    return;
  }
  openModal(descriptor);
}
