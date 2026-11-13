/** Informational dialogs: rules, cipher guide, settings, space inspector, intro. */

import { el, mount } from './dom.js';
import { openModal, closeModal } from './modal.js';
import { icon } from './icons.js';
import { formatMoney } from '../utils/formatters.js';
import {
  buildCipherBlock,
  buildGroupChip,
  buildRentTable,
  buildSpaceFacts,
  buildSpaceIdentity,
  getOwner,
  typeMeta
} from './presenters.js';
import { getOwnedProperties } from '../core/game-state.js';

function section(title, ...children) {
  const node = el('section', { class: 'doc-section' });
  node.appendChild(el('h3', { text: title }));
  node.append(...children.filter(Boolean));
  return node;
}

function list(items, ordered = false) {
  const node = el(ordered ? 'ol' : 'ul');
  for (const item of items) node.appendChild(el('li', { text: item }));
  return node;
}

export function buildHelpContent(app) {
  const wrap = el('div');
  wrap.appendChild(
    section(
      'Tujuan permainan',
      el('p', {
        text: 'Menjadi investor terakhir yang masih mampu memenuhi kewajiban finansial. Pemenang dihitung sepenuhnya oleh mesin Monopoli; cerita Cryptonia hanya lapisan tampilan.'
      })
    )
  );
  wrap.appendChild(
    section(
      'Persiapan',
      list([
        'Daftarkan 2–8 investor dengan nama unik dan token berbeda.',
        'Setiap investor mulai dengan saldo sesuai profil edisi (saat ini 1.500 CR).',
        'Seluruh nama petak dan isi kartu ditampilkan sebagai sandi angka. Gunakan panduan invers fungsi untuk membacanya.',
        'Kunci sandi pengembangan harus diaktifkan secara sadar sebelum permainan dimulai.'
      ])
    )
  );
  wrap.appendChild(
    section(
      'Alur giliran',
      list([
        'Lempar dadu. Token bergerak maju sesuai total dadu.',
        'Selesaikan petak: beli/lelang, bayar sewa atau pajak, tarik kartu, atau masuk penjara.',
        'Gunakan aset, bangun, gadaikan, atau ajukan pertukaran bila fase mengizinkan.',
        'Akhiri giliran. Dadu ganda memberi satu lemparan tambahan; tiga dadu ganda berturut-turut mengirim pemain ke Pusat Detensi.',
        'Giliran tidak dapat diakhiri selama masih ada keputusan, pembayaran, lelang, dekripsi kartu, atau penyelesaian utang.'
      ])
    )
  );
  wrap.appendChild(
    section(
      'Properti dan sewa',
      list([
        'Properti tanpa pemilik dapat dibeli dengan harga yang tertera atau dilelang.',
        'Sewa dihitung dari tabel deed, kepemilikan seluruh grup warna, jumlah rumah/hotel, jumlah stasiun, atau total dadu untuk utilitas.',
        'Properti yang digadaikan tidak menghasilkan sewa.',
        'Nilai angka seperti harga, sewa, dan pajak selalu ditampilkan sebagai angka biasa, bukan sandi.'
      ])
    )
  );
  wrap.appendChild(
    section(
      'Lelang',
      list([
        'Menolak membeli properti membuka lelang berurutan.',
        'Penawaran harus lebih tinggi dari penawaran saat ini dan memenuhi kenaikan minimum.',
        'Peserta yang lewat keluar dari lelang. Penawar tertinggi menang saat semua peserta lain lewat.',
        'Jika semua peserta lewat, properti tetap tanpa pemilik.'
      ])
    )
  );
  wrap.appendChild(
    section(
      'Bangunan, gadai, dan pertukaran',
      list([
        'Rumah hanya dapat dibangun setelah seluruh properti dalam satu grup warna dimiliki dan tidak ada yang digadaikan.',
        'Bangunan harus merata; hotel dibangun setelah empat rumah dan membutuhkan persediaan bank.',
        'Menjual bangunan mengikuti urutan kebalikan dan mengembalikan sebagian biaya.',
        'Gadai memberi uang tunai; menebus gadai membayar nilai gadai plus bunga sesuai profil.',
        'Pertukaran dapat berisi uang, properti tanpa bangunan di grupnya, dan kartu bebas penjara. Kedua pihak harus menyetujui.'
      ])
    )
  );
  wrap.appendChild(
    section(
      'Penjara',
      list([
        'Pemain dapat mencoba dadu ganda, membayar denda, atau memakai kartu bebas penjara.',
        'Setelah tiga percobaan gagal, denda wajib dibayar lalu pemain bergerak sesuai dadu.',
        'Jika saldo tidak cukup, permainan masuk ke penyelesaian utang.'
      ])
    )
  );
  wrap.appendChild(
    section(
      'Kartu dan dekripsi',
      list([
        'Kartu Kesempatan dan Arsip Kota memiliki dek terpisah dan diacak sekali di awal permainan.',
        'Isi kartu hanya ditampilkan sebagai sandi angka sampai pemain mengetik hasil dekripsi yang benar.',
        'Jawaban yang salah tidak menjalankan efek apa pun. Setelah benar, pemain tetap harus mengonfirmasi efek.',
        'Efek kartu dijalankan tepat satu kali dari data terstruktur, bukan dari teks yang terlihat.',
        'Mode bantuan bersifat opsional dan nonaktif secara default.'
      ])
    )
  );
  wrap.appendChild(
    section(
      'Kebangkrutan dan kemenangan',
      list([
        'Pemain yang tidak mampu membayar dapat menjual bangunan, menggadaikan properti, atau menyatakan bangkrut.',
        'Saat bangkrut, aset diselesaikan menurut profil edisi; jika kreditur adalah pemain, aset berpindah kepadanya. Jika kreditur bank, properti kembali tanpa pemilik.',
        'Permainan berakhir ketika hanya satu pemain solven yang tersisa. Pemain itu menjadi pemenang.'
      ])
    )
  );
  wrap.appendChild(
    section(
      'Kontrol, simpan, dan aksesibilitas',
      list([
        'Gunakan tombol Lempar Dadu, panel tindakan, dan dialog keputusan. Semua tombol memiliki aksi nyata atau keadaan nonaktif.',
        'Klik petak papan untuk memeriksa sandi, harga, sewa, dan status kepemilikan.',
        'Permainan disimpan otomatis ke localStorage setelah transisi yang selesai. Gunakan Menu untuk keluar dan Lanjutkan Permainan untuk melanjutkan.',
        'Fokus keyboard terlihat. Tekan Escape untuk menutup panel informasi yang dapat ditutup; dialog keputusan wajib tidak dapat ditutup sebelum selesai.',
        'Aktifkan Pengaturan → Kurangi animasi bila perangkat lambat.'
      ])
    )
  );
  return wrap;
}

export function buildGuideContent(app) {
  const cipher = app.cipher;
  const wrap = el('div');

  wrap.appendChild(
    section(
      'Model sandi',
      el('p', {
        text: 'Setiap huruf dipetakan ke indeks A=0, B=1, …, Z=25. Dua fungsi affine dikomposisikan, lalu hasilnya ditampilkan sebagai kode dua digit.'
      }),
      el(
        'div',
        { class: 'formula-stack' },
        el('span', {}, el('span', { class: 'formula-key', text: 'f(x) = ' }), cipher.formulas.f),
        el('span', {}, el('span', { class: 'formula-key', text: 'g(x) = ' }), cipher.formulas.g),
        el('span', {}, el('span', { class: 'formula-key', text: 'E(x) = ' }), cipher.formulas.encryption),
        el('span', {}, el('span', { class: 'formula-key', text: 'f⁻¹(y) = ' }), cipher.formulas.inverseF),
        el('span', {}, el('span', { class: 'formula-key', text: 'g⁻¹(y) = ' }), cipher.formulas.inverseG),
        el('span', {}, el('span', { class: 'formula-key', text: 'E⁻¹(y) = ' }), cipher.formulas.decryption)
      ),
      el('p', {
        text: 'Urutan invers harus dibalik: jika E = g(f(x)), maka E⁻¹(y) = f⁻¹(g⁻¹(y)). Kode tampilan memakai offset +1, sehingga nilai 0 ditampilkan sebagai 08, nilai 1 sebagai 09, dan seterusnya.'
      })
    )
  );

  wrap.appendChild(
    section(
      'Contoh kerja: kode 08',
      el('div', { class: 'example-steps' },
        el('div', { class: 'example-step' }, 'Kode ', el('code', { text: '08' }), ' dikurangi offset 1 menjadi nilai ', el('code', { text: '7' }), '.'),
        el('div', { class: 'example-step' }, 'Hitung ', el('code', { text: 'g⁻¹(7)' }), ' menggunakan invers g. Hasilnya indeks ', el('code', { text: '8' }), '.'),
        el('div', { class: 'example-step' }, 'Hitung ', el('code', { text: 'f⁻¹(8)' }), ' menggunakan invers f. Hasilnya indeks ', el('code', { text: '0' }), '.'),
        el('div', { class: 'example-step' }, 'Indeks ', el('code', { text: '0' }), ' adalah huruf ', el('code', { text: 'A' }), '. Jadi ', el('code', { text: '08 → A' }), '.')
      ),
      el('p', { class: 'tiny muted', text: `Kunci aktif: ${cipher.config.keyId ?? 'tanpa-id'} · mode ${cipher.config.mode ?? '—'} · ${cipher.config.approved ? 'disetujui' : 'belum disetujui (demo/pengembangan)'}.` })
    )
  );

  const mapping = el('div', { class: 'mapping-grid' });
  for (let index = 0; index < 26; index += 1) {
    const letter = String.fromCharCode(65 + index);
    mapping.appendChild(
      el(
        'div',
        { class: 'mapping-cell' },
        el('span', { text: letter }),
        el('span', { class: 'mapping-arrow', text: '→' }),
        el('span', { class: 'mapping-code', text: cipher.codeForIndex(index) })
      )
    );
  }
  wrap.appendChild(section('Tabel pemetaan 26 huruf', mapping));

  wrap.appendChild(
    section(
      'Format teks sandi',
      list([
        'Setiap huruf menjadi tepat dua digit, misalnya 08 15 06.',
        'Tanda / memisahkan kata. Spasi di sekitar / tidak memengaruhi jawaban.',
        'Angka asli dipertahankan di dalam tanda kurung siku, misalnya [200], agar tidak dikira kode huruf.',
        'Tanda baca dipertahankan dan tidak perlu didekripsi.',
        'Saat menjawab, huruf besar/kecil, spasi berlebih, dan tanda baca diabaikan. Makna kalimat tetap harus benar.'
      ])
    )
  );

  wrap.appendChild(
    section(
      'Kesalahan yang sering terjadi',
      list([
        'Menerapkan f⁻¹ lebih dulu padahal komposisinya g(f(x)). Urutan invers harus dibalik.',
        'Lupa mengurangi offset 1 sebelum menghitung invers.',
        'Menganggap harga, sewa, atau nominal uang sebagai kode huruf. Nilai permainan selalu angka biasa.',
        'Mengetik kode angka sebagai jawaban, bukan huruf hasil dekripsi.',
        'Menganggap sandi ini aman untuk data nyata. Sandi ini hanya alat pembelajaran fungsi komposisi dan invers.'
      ])
    )
  );

  wrap.appendChild(
    section(
      'Verifikasi kunci',
      el('p', {
        text: 'Mesin memeriksa seluruh 26 huruf bolak-balik sebelum permainan dimulai. Jika ada huruf yang tidak kembali ke indeks asalnya, permainan menolak berjalan.'
      }),
      el('p', { class: 'tiny muted', text: 'Uji wajib proyek: mendekripsi 08 dengan invers contoh harus menghasilkan A.' })
    )
  );
  return wrap;
}

function settingRow(app, key, label, description, { warning = false } = {}) {
  const row = el('label', { class: 'check-row' });
  row.appendChild(
    el('input', {
      type: 'checkbox',
      checked: Boolean(app.settings[key]),
      onChange: (event) => app.updateSetting(key, event.target.checked)
    })
  );
  const text = el('span');
  text.appendChild(el('strong', { text: label }));
  text.appendChild(el('span', { class: 'tiny muted', text: description }));
  if (warning) text.appendChild(el('span', { class: 'tiny danger-text', text: 'Opsi ini membuka informasi yang biasanya disembunyikan.' }));
  row.appendChild(text);
  return row;
}

export function buildSettingsContent(app) {
  const wrap = el('div', { class: 'dialog-stack' });
  const key = app.engine?.state?.encryptionConfig ?? app.data.encryptionConfig;

  const group = el('div', { class: 'dialog-section' });
  group.appendChild(el('h3', { text: 'Pembelajaran' }));
  group.appendChild(
    settingRow(app, 'assistedMode', 'Mode bantuan dekripsi', 'Menampilkan tombol bantuan pada dialog kartu. Nonaktif secara default.')
  );
  group.appendChild(
    settingRow(app, 'revealAnswer', 'Tampilkan jawaban (guru/demo)', 'Menampilkan jawaban kartu setelah bantuan dipilih. Gunakan hanya untuk demonstrasi.', {
      warning: true
    })
  );
  group.appendChild(
    settingRow(app, 'showBoardPlaintext', 'Tampilkan teks asli papan', 'Menampilkan nama asli petak di panel pemeriksa dan dialog. Nonaktif secara default.', {
      warning: true
    })
  );
  wrap.appendChild(group);

  const display = el('div', { class: 'dialog-section' });
  display.appendChild(el('h3', { text: 'Tampilan & aksesibilitas' }));
  display.appendChild(settingRow(app, 'reducedMotion', 'Kurangi animasi', 'Melewati animasi dadu dan perpindahan token.'));
  wrap.appendChild(display);

  const info = el('div', { class: 'dialog-section' });
  info.appendChild(el('h3', { text: 'Kunci sandi aktif' }));
  info.appendChild(
    el('div', { class: 'formula-stack' },
      el('span', { text: `ID: ${key.keyId ?? '—'}` }),
      el('span', { text: `Mode: ${key.mode ?? '—'} · ${key.approved ? 'disetujui' : 'belum disetujui'}` }),
      el('span', { text: app.cipher.formulas.encryption }),
      el('span', { text: app.cipher.formulas.decryption })
    )
  );
  wrap.appendChild(info);

  const data = el('div', { class: 'dialog-section' });
  data.appendChild(el('h3', { text: 'Penyimpanan & cerita' }));
  const row = el('div', { class: 'btn-row' });
  row.appendChild(
    el(
      'button',
      { class: 'btn btn-secondary', type: 'button', onClick: () => app.replayPrologue() },
      el('span', { text: 'Putar Ulang Prolog' })
    )
  );
  row.appendChild(
    el(
      'button',
      {
        class: 'btn btn-danger',
        type: 'button',
        onClick: () =>
          app.requestConfirm({
            context: 'settings',
            message: 'Hapus save lokal? Permainan yang sedang berjalan tidak dapat dilanjutkan lagi.',
            action: () => app.clearSaveData()
          })
      },
      el('span', { text: 'Hapus Save Lokal' })
    )
  );
  data.appendChild(row);
  if (app.confirm && app.confirm.context === 'settings') {
    const bar = el('div', { class: 'confirm-bar' });
    bar.appendChild(el('p', { text: app.confirm.message }));
    const buttons = el('div', { class: 'btn-row' });
    buttons.appendChild(
      el('button', { class: 'btn btn-danger', type: 'button', onClick: () => app.runConfirm() }, el('span', { text: 'Ya, hapus' }))
    );
    buttons.appendChild(
      el('button', { class: 'btn btn-secondary', type: 'button', onClick: () => app.cancelConfirm() }, el('span', { text: 'Batal' }))
    );
    bar.appendChild(buttons);
    data.appendChild(bar);
  }
  data.appendChild(
    el('p', { class: 'tiny faint', text: 'Save lokal memakai skema versi dan divalidasi sebelum dimuat. Data cerita dan aturan berada di folder data/.' })
  );
  wrap.appendChild(data);

  wrap.appendChild(el('p', { class: 'tiny faint', text: 'Perubahan pengaturan langsung disimpan dan diterapkan.' }));
  return wrap;
}

export function openHelp(app) {
  openModal({
    key: 'help',
    kicker: 'PANDUAN PERMAINAN',
    title: 'Cara Bermain',
    subtitle: 'Aturan Monopoli, alur giliran, dan kontrol antarmuka.',
    dismissible: true,
    wide: true,
    content: buildHelpContent(app)
  });
}

export function openGuide(app) {
  openModal({
    key: 'guide',
    kicker: 'MATEMATIKA SANDI',
    title: 'Panduan Enkripsi & Dekripsi',
    subtitle: 'Komposisi dua fungsi affine dan inversnya.',
    dismissible: true,
    wide: true,
    content: buildGuideContent(app)
  });
}

export function openSettings(app) {
  app.confirm = null;
  openModal({
    key: 'settings',
    kicker: 'PENGATURAN',
    title: 'Pengaturan',
    subtitle: 'Pembelajaran, tampilan, dan penyimpanan lokal.',
    dismissible: true,
    wide: true,
    content: buildSettingsContent(app),
    onClose: () => {
      app.confirm = null;
    }
  });
}

export function refreshSettingsDialog(app) {
  const active = document.querySelector('.modal-overlay .modal-title');
  if (active?.textContent !== 'Pengaturan') return;
  app.updateDialogContent(buildSettingsContent(app));
}

export function openSpaceInspector(app, spaceId) {
  const space = app.data.spacesById[spaceId];
  if (!space) return;
  const meta = typeMeta(space.type);
  const state = app.engine?.state;
  const property = app.data.propertiesBySpaceId[spaceId];
  const pstate = state?.properties?.[spaceId];
  const wrap = el('div', { class: 'dialog-stack' });

  wrap.appendChild(buildSpaceIdentity(app, space));
  wrap.appendChild(buildSpaceFacts(app, space));

  if (property) {
    const group = property.group ? buildGroupChip(app.data, property.group) : null;
    if (group) wrap.appendChild(group);
    if (property.kind === 'STREET') {
      const table = buildRentTable(app.data, property, pstate, app.data.profile.currency);
      if (table) wrap.appendChild(table);
      wrap.appendChild(
        el('p', {
          class: 'tiny faint',
          text: `Biaya rumah ${formatMoney(property.houseCost, app.data.profile.currency)} · Sewa dasar ${formatMoney(
            property.rent[0],
            app.data.profile.currency
          )} · Sewa hotel ${formatMoney(property.rent[5], app.data.profile.currency)}.`
        })
      );
    } else if (property.kind === 'RAILROAD') {
      wrap.appendChild(
        el('p', {
          class: 'tiny muted',
          text: `Sewa stasiun mengikuti jumlah stasiun yang dimiliki: ${app.data.profile.railroadRent.join(' / ')} ${app.data.profile.currency}.`
        })
      );
    } else if (property.kind === 'UTILITY') {
      wrap.appendChild(
        el('p', {
          class: 'tiny muted',
          text: `Sewa utilitas = total dadu × ${app.data.profile.utilityRentMultiplier.join(' atau ')} sesuai jumlah utilitas yang dimiliki.`
        })
      );
    }
  }

  if (pstate?.ownerId && state) {
    const owner = getOwner(state, pstate.ownerId);
    if (owner) {
      wrap.appendChild(
        el('div', { class: 'info-box' }, el('p', {
          text: `Pemilik: ${owner.name}. Bangunan: ${pstate.hotel ? 'hotel' : `${pstate.houses} rumah`}. ${
            pstate.mortgaged ? 'Properti sedang digadaikan.' : 'Properti tidak digadaikan.'
          }`
        }))
      );
    }
  }

  if (space.type === 'CHANCE' || space.type === 'COMMUNITY_CHEST') {
    const deckKey = space.type === 'CHANCE' ? 'chance' : 'communityChest';
    const deckStory = app.story?.decks?.[deckKey];
    wrap.appendChild(
      el('div', { class: 'info-box' }, el('p', { class: 'strong', text: deckStory?.label ?? 'Dek' }), el('p', {
        text: deckStory?.framing ?? 'Kartu diambil dari dek terenkripsi.'
      }))
    );
  }

  if (space.type === 'TAX') {
    wrap.appendChild(
      el('div', { class: 'warning-box' }, el('p', {
        text: `Berhenti di petak ini memicu pembayaran ${formatMoney(space.taxAmount, app.data.profile.currency)} ke bank.`
      }))
    );
  }

  if (space.type === 'GO') {
    wrap.appendChild(
      el('div', { class: 'success-box' }, el('p', {
        text: `Melewati atau berhenti di Gerbang Kota memberi gaji ${formatMoney(app.data.profile.goSalary, app.data.profile.currency)}.`
      }))
    );
  }

  if (space.type === 'JAIL') {
    wrap.appendChild(
      el('div', { class: 'info-box' }, el('p', { text: 'Hanya mengunjungi tidak memberi efek tambahan. Pemain yang ditahan memakai opsi penjara pada gilirannya.' }))
    );
  }

  if (space.type === 'FREE_PARKING') {
    wrap.appendChild(
      el('div', { class: 'info-box' }, el('p', { text: 'Tidak ada jackpot pada profil ini. Berhenti di sini tidak mengubah saldo.' }))
    );
  }

  const actions = el('div', { class: 'dialog-actions' });
  if (pstate?.ownerId && state?.players[state.currentPlayerIndex]?.id === pstate.ownerId) {
    actions.appendChild(
      el(
        'button',
        { class: 'btn btn-secondary', type: 'button', onClick: () => { closeModal({ force: true }); app.openAssets(); } },
        el('span', { text: 'Kelola Aset' })
      )
    );
  }
  actions.appendChild(
    el('button', { class: 'btn btn-primary', type: 'button', onClick: () => closeModal({ force: true }) }, el('span', { text: 'Tutup' }))
  );
  wrap.appendChild(actions);

  openModal({
    key: 'inspector',
    kicker: `PETAK ${String(space.index).padStart(2, '0')} · ${meta.label.toUpperCase()}`,
    title: 'Pemeriksa Petak',
    subtitle: 'Nilai permainan tetap terbaca; nama petak tetap terenkripsi.',
    dismissible: true,
    wide: true,
    content: wrap
  });
}

export function openIntro(app) {
  const intro = app.story?.gameIntro;
  if (!intro) return;
  const wrap = el('div', { class: 'dialog-stack' });
  wrap.appendChild(el('p', { class: 'dialog-lead', text: intro.text }));
  wrap.appendChild(
    el('div', { class: 'formula-stack' },
      el('span', {}, el('span', { class: 'formula-key', text: 'E(x) = ' }), app.cipher.formulas.encryption),
      el('span', {}, el('span', { class: 'formula-key', text: 'E⁻¹(y) = ' }), app.cipher.formulas.decryption),
      el('span', { text: `Contoh: 08 → A · offset tampilan +${app.cipher.offset}` })
    )
  );
  const key = app.data.encryptionConfig;
  if (!key.approved) {
    wrap.appendChild(
      el('div', { class: 'warning-box' }, el('p', {
        text: `Kunci ${key.keyId ?? 'pengembangan'} belum disetujui guru. Mode demo aktif; jangan gunakan untuk penilaian resmi sebelum kunci final ditetapkan.`
      }))
    );
  }
  wrap.appendChild(
    el('p', {
      class: 'tiny muted',
      text: 'Nama petak dan isi kartu ditampilkan sebagai sandi angka. Harga, sewa, saldo, dan dadu tetap angka biasa.'
    })
  );
  wrap.appendChild(
    el(
      'button',
      { class: 'btn btn-primary btn-block', type: 'button', onClick: () => closeModal({ force: true }) },
      el('span', { text: intro.dismiss ?? 'Masuk ke Papan' })
    )
  );
  openModal({
    key: 'intro',
    kicker: 'PASAR PROPERTI DIBUKA',
    title: intro.title ?? 'Pasar Cryptonia Dibuka',
    subtitle: 'Bacaan singkat sebelum giliran pertama.',
    dismissible: true,
    content: wrap
  });
}

export { getOwnedProperties };
