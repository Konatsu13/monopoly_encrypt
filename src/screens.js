/**
 * Menu, prologue, and setup screens.
 *
 * These renderers only read app state and call app methods. They never touch
 * the engine directly, so the same flow works from the menu and from a
 * resumed game.
 */

import { el, mount, formatDateTime } from './ui/dom.js';
import { icon } from './ui/icons.js';
import { formatMoney } from './utils/formatters.js';
import { buildStatGrid } from './ui/presenters.js';
import { loadGame } from './storage/local-save.js';

function setText(id, value) {
  const node = document.getElementById(id);
  if (node) node.textContent = value ?? '';
}

function setHidden(id, hidden) {
  const node = document.getElementById(id);
  if (node) node.hidden = Boolean(hidden);
}

function menuButton({ number, label, description, onClick, primary = false, disabled = false }) {
  return el(
    'button',
    {
      class: `menu-button${primary ? ' is-primary' : ''}`,
      type: 'button',
      disabled,
      onClick
    },
    el('span', { class: 'menu-num', text: number }),
    el(
      'span',
      {},
      el('span', { class: 'menu-label', text: label }),
      description ? el('span', { class: 'menu-sub', text: description }) : null
    ),
    el('span', { class: 'menu-arrow' }, icon('chevronRight', { size: 14 }))
  );
}

export function renderMenu(app) {
  const story = app.story;
  const menu = story.menu;
  setText('menu-tagline', story.tagline ?? menu.subtitle);
  setText('menu-year', story.year ?? '2099');
  setText('menu-city', story.city ?? 'Cryptonia');
  setText('menu-footer', menu.footer);

  const saved = loadGame(app.data);
  app.menuSaveResult = saved;

  const status = document.getElementById('menu-save-status');
  if (status) {
    if (saved.ok) {
      status.textContent = `Save lokal ditemukan · terakhir ${formatDateTime(saved.savedAt)}`;
      status.className = 'menu-save-status tiny is-ok';
    } else if (saved.empty) {
      status.textContent = 'Belum ada save lokal. Mulai permainan baru untuk membuat save.';
      status.className = 'menu-save-status tiny';
    } else {
      status.textContent = `Save tidak dapat dimuat: ${saved.reason}`;
      status.className = 'menu-save-status tiny danger-text';
    }
  }

  const actions = [];
  actions.push(
    menuButton({
      number: '01',
      label: menu.continueGame,
      description: saved.ok ? 'Lanjutkan posisi terakhir dari save lokal.' : 'Belum ada save lokal yang valid.',
      primary: saved.ok,
      disabled: !saved.ok,
      onClick: () => app.continueGame()
    })
  );
  actions.push(
    menuButton({
      number: '02',
      label: menu.newGame,
      description: 'Baca prolog lalu daftarkan 2–8 investor.',
      primary: !saved.ok,
      onClick: () => app.newGameFlow()
    })
  );
  actions.push(
    menuButton({
      number: '03',
      label: menu.story,
      description: 'Tiga layar pengantar Cryptonia tahun 2099.',
      onClick: () => app.startPrologue('menu')
    })
  );
  actions.push(
    menuButton({
      number: '04',
      label: menu.howToPlay,
      description: 'Aturan, alur giliran, lelang, dan penjara.',
      onClick: () => app.openHelp()
    })
  );
  actions.push(
    menuButton({
      number: '05',
      label: menu.encryptionGuide,
      description: 'Komposisi fungsi, invers, dan tabel 26 huruf.',
      onClick: () => app.openGuide()
    })
  );
  actions.push(
    menuButton({
      number: '06',
      label: menu.settings,
      description: 'Mode bantuan, tampilan, dan penyimpanan.',
      onClick: () => app.openSettings()
    })
  );

  mount(document.getElementById('menu-actions'), actions);
}

export function renderPrologue(app) {
  const story = app.story.prologue;
  const slides = story.slides ?? [];
  const index = Math.max(0, Math.min(app.prologueIndex, slides.length - 1));
  const slide = slides[index];
  if (!slide) return;

  setText('prologue-kicker', story.kicker ?? 'ARSIP KOTA');
  setText('prologue-count', `${String(index + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}`);
  setText('prologue-title', slide.title);
  mount(
    document.getElementById('prologue-body'),
    (slide.paragraphs ?? []).map((paragraph) => el('p', { text: paragraph }))
  );

  const dots = document.getElementById('prologue-dots');
  if (dots) {
    mount(
      dots,
      slides.map((_, dotIndex) =>
        el('span', {
          class: `progress-dot${dotIndex === index ? ' is-active' : ''}`,
          'aria-hidden': 'true'
        })
      )
    );
  }

  const back = document.getElementById('prologue-back');
  if (back) {
    back.textContent = story.backLabel ?? 'Kembali';
    back.disabled = index === 0;
  }

  const next = document.getElementById('prologue-next');
  if (next) {
    const last = index === slides.length - 1;
    const returnsToSetup = app.prologueContext === 'new-game' || app.prologueContext === 'setup';
    next.textContent = last
      ? returnsToSetup
        ? story.startLabel ?? 'Mulai'
        : 'Selesai'
      : story.nextLabel ?? 'Lanjut';
  }

  const skip = document.getElementById('prologue-skip');
  if (skip) skip.textContent = story.skipLabel ?? 'Lewati prolog';
}

export function renderSetup(app) {
  const setup = app.story.setup;
  const profile = app.data.profile;
  const config = app.data.encryptionConfig;
  const currency = profile.currency;

  setText('setup-title', setup.heading);
  setText('setup-intro', setup.intro);
  setText('setup-count', `${app.setupDraft.length} / 8`);
  setText('setup-flavor', app.story.flavor?.purchase?.[0] ?? '');
  setText('setup-add', setup.addPlayer);
  setText('setup-remove', setup.removePlayer);
  setText('setup-start', setup.startGame);

  const error = document.getElementById('setup-error');
  if (error) {
    error.textContent = app.setupError ?? '';
    error.hidden = !app.setupError;
  }

  const rows = app.setupDraft.map((player, index) => {
    const usedByOthers = app.setupDraft
      .filter((_, otherIndex) => otherIndex !== index)
      .map((entry) => entry.tokenId);

    const row = el('div', { class: 'setup-player-row' });

    row.appendChild(el('span', { class: 'row-number', text: String(index + 1).padStart(2, '0') }));

    const nameField = el('div', { class: 'field field-name' });
    nameField.appendChild(
      el('label', {
        class: 'visually-hidden',
        for: `setup-name-${index}`,
        text: `${setup.nameLabel} ${index + 1}`
      })
    );
    nameField.appendChild(
      el('input', {
        id: `setup-name-${index}`,
        class: 'input',
        type: 'text',
        value: player.name ?? '',
        placeholder: `${setup.nameLabel} ${index + 1}`,
        maxlength: '24',
        autocomplete: 'off',
        spellcheck: 'false',
        onInput: (event) => app.setSetupPlayerName(index, event.target.value)
      })
    );
    row.appendChild(nameField);

    const tokenField = el('div', { class: 'field field-token' });
    tokenField.appendChild(
      el('label', {
        class: 'visually-hidden',
        for: `setup-token-${index}`,
        text: `${setup.tokenLabel} ${index + 1}`
      })
    );
    const select = el('select', {
      id: `setup-token-${index}`,
      class: 'select',
      onChange: (event) => app.setSetupPlayerToken(index, event.target.value)
    });
    for (const token of app.data.tokens) {
      const disabled = usedByOthers.includes(token.id);
      select.appendChild(
        el('option', {
          value: token.id,
          text: `${token.label}${disabled ? ' — dipakai' : ''}`,
          selected: player.tokenId === token.id,
          disabled
        })
      );
    }
    tokenField.appendChild(select);
    row.appendChild(tokenField);

    row.appendChild(
      el(
        'button',
        {
          class: 'btn btn-ghost btn-small row-remove',
          type: 'button',
          disabled: app.setupDraft.length <= 2,
          title: app.setupDraft.length <= 2 ? 'Minimal dua investor.' : 'Hapus investor ini.',
          onClick: () => app.removeSetupPlayer(index)
        },
        icon('trash', { size: 13 }),
        el('span', { text: 'Hapus' })
      )
    );

    return row;
  });

  mount(document.getElementById('setup-players'), rows);

  const facts = document.getElementById('setup-profile-facts');
  if (facts) {
    const grid = buildStatGrid([
      { label: 'Saldo awal', value: formatMoney(profile.startingCash, currency), className: 'is-gold' },
      { label: 'Gaji GO', value: formatMoney(profile.goSalary, currency) },
      { label: 'Denda penjara', value: formatMoney(profile.jailFine, currency) },
      { label: 'Persediaan', value: `${profile.houseSupply} rumah · ${profile.hotelSupply} hotel` },
      { label: 'Lelang', value: profile.auctionEnabled ? 'Aktif' : 'Nonaktif' }
    ]);
    mount(facts, ...[...grid.children]);
  }
  setText('setup-profile-label', profile.label);
  setText('setup-profile-source', profile.sourceEdition);

  const keyMode = document.getElementById('setup-key-mode');
  if (keyMode) {
    keyMode.textContent = config.mode ?? 'DEVELOPMENT';
    keyMode.className = `badge ${config.approved ? 'badge-ok' : 'badge-warn'}`;
  }
  setText(
    'setup-key-id',
    `${config.keyId ?? 'tanpa-id'} · ${config.approved ? 'disetujui guru' : 'belum disetujui guru'}`
  );

  const formulaList = document.getElementById('setup-formulas');
  if (formulaList) {
    const rows = [
      ['f(x)', app.cipher.formulas.f],
      ['g(x)', app.cipher.formulas.g],
      ['E(x)', app.cipher.formulas.encryption.replace(/^E\(x\) = /, '')],
      ['E⁻¹(y)', app.cipher.formulas.decryption.replace(/^E⁻¹\(y\) = /, '')]
    ];
    mount(
      formulaList,
      rows.map(([label, value]) =>
        el(
          'div',
          { class: 'formula-row' },
          el('span', { class: 'formula-label', text: label }),
          el('span', { class: 'formula-value', text: value })
        )
      )
    );
  }

  const worked = document.getElementById('setup-worked');
  if (worked) {
    mount(
      worked,
      el('div', { text: 'Uji kunci: kode 08 → A' }),
      el('div', { text: '08 − offset 1 = 07 → g⁻¹ → f⁻¹ → indeks 0 → A' }),
      el('div', { text: 'Urutan invers: E⁻¹(y) = f⁻¹(g⁻¹(y))' })
    );
  }

  const warning = document.getElementById('setup-key-warning');
  if (warning) warning.hidden = Boolean(config.approved);
  setText('setup-key-warning-text', setup.developmentWarning);
  setText('setup-ack-text', setup.developmentConfirm);

  const demo = document.getElementById('setup-demo');
  if (demo) demo.checked = Boolean(app.setupDemo);
  const ack = document.getElementById('setup-ack');
  if (ack) ack.checked = Boolean(app.setupAck);

  const demoLabel = demo?.closest('label');
  if (demoLabel) demoLabel.hidden = Boolean(config.approved);
  const ackLabel = ack?.closest('label');
  if (ackLabel) ackLabel.hidden = Boolean(config.approved);
}
