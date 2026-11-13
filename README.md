# THE LOST CIPHER — Encrypted Monopoly

Permainan Monopoli lokal untuk 2–8 pemain di satu perangkat. Nama petak dan isi kartu ditampilkan sebagai sandi angka hasil komposisi dua fungsi affine. Harga, sewa, saldo, dadu, dan nilai aturan lainnya tetap ditampilkan sebagai angka biasa.

Aplikasi ini adalah situs statis: tidak ada backend, akun, jaringan, atau dependensi runtime. Seluruh data permainan berada di folder `data/` dan dapat diperiksa atau diubah tanpa membangun ulang aplikasi.

> **Status kunci:** `data/encryption-config.json` saat ini memakai kunci pengembangan `dev-key-01` dengan `approved: false`. Setup mewajibkan pemain mengaktifkan mode pengembangan dan mencentang pernyataan sebelum permainan dimulai. Kunci ini untuk pembelajaran fungsi komposisi dan invers, bukan untuk keamanan data nyata.

---

## Menjalankan aplikasi

Prasyarat: Node.js 20 atau lebih baru (diuji dengan Node 26).

```bash
npm start
```

Buka:

```text
http://localhost:5173
```

Port lain:

```bash
npm start -- 3000
```

Tidak perlu `npm install` karena proyek ini tidak memiliki dependensi runtime.

**Jangan membuka `index.html` langsung dari File Explorer.** Aplikasi memakai ES modules dan `fetch()` untuk memuat JSON. Keduanya membutuhkan server HTTP. Jika dibuka lewat `file://`, layar loading akan menampilkan pesan kegagalan dan meminta Anda menjalankan `npm start`.

### Tes

```bash
npm test
```

Saat README ini ditulis: **98 tes lulus, 0 gagal**.

---

## Layar dan alur pemakaian

1. **Loading** — memuat sembilan berkas JSON, memvalidasi data, dan menguji bolak-balik seluruh 26 huruf pada kunci sandi.
2. **Fatal** — muncul jika data tidak valid atau kunci tidak reversibel. Halaman tidak dibiarkan menggantung di spinner.
3. **Menu** — Mulai Baru, Lanjutkan Permainan, Cerita, Cara Bermain, Panduan Enkripsi & Dekripsi, dan Pengaturan.
4. **Prolog** — tiga layar cerita Cryptonia 2099. Prolog hanya lapisan suasana dan tidak menambah mekanik permainan.
5. **Setup** — daftarkan 2–8 investor, isi nama, pilih token unik, lihat profil edisi dan kunci sandi. Kunci pengembangan harus diaktifkan dan disetujui lewat dua kotak centang.
6. **Permainan** — papan 40 petak, daftar investor, panel tindakan, catatan kota, dialog keputusan wajib, dan panel informasi.

Di dalam permainan:

- Tombol header: **Cara Bermain**, **Panduan Sandi**, **Pengaturan**, dan **Menu**.
- Klik petak papan untuk membuka pemeriksa petak: sandi nama, harga, sewa, status pemilik, bangunan, dan gadai.
- Panel tindakan berubah mengikuti fase: lempar dadu, beli/lelang, dekripsi kartu, lelang, penyelesaian utang, penjara, pertukaran, atau akhir giliran.
- Dialog keputusan wajib tidak dapat ditutup dengan Escape sampai keputusan selesai. Panel informasi biasa dapat ditutup dengan Escape atau tombol tutup.
- Permainan disimpan otomatis setelah transisi yang berhasil. Indikator simpan ada di header.

---

## Isi permainan

### Papan dan properti

- 40 petak dengan tata letak Monopoli klasik.
- 28 properti yang dapat dimiliki: 22 jalan, 4 stasiun, dan 2 utilitas.
- 8 grup warna jalan.
- Nama petak adalah nama orisinal Cryptonia, misalnya `GERBANG KOTA`, `JALAN KABUT`, `STASIUN UTARA`, dan `PUNCAK CRYPTONIA`.
- Harga, sewa, nilai gadai, biaya rumah, dan pajak selalu berupa angka biasa.
- Sewa jalan mengikuti tabel enam tingkat: dasar, 1–4 rumah, dan hotel.
- Sewa jalan menjadi dua kali lipat jika satu pemain memiliki seluruh grup warna dan belum ada bangunan.
- Sewa stasiun mengikuti jumlah stasiun yang dimiliki.
- Sewa utilitas mengikuti total dadu dikali 4 atau 10 sesuai jumlah utilitas yang dimiliki.
- Properti yang digadaikan tidak menghasilkan sewa.

### Giliran dan dadu

- Dua dadu enam sisi.
- Dadu ganda memberi lemparan tambahan.
- Tiga dadu ganda berturut-turut mengirim pemain ke Pusat Detensi.
- Melewati atau berhenti di Gerbang Kota memberi gaji.
- Giliran tidak dapat diakhiri selama masih ada keputusan, pembayaran, lelang, dekripsi kartu, atau utang yang belum selesai.

### Pembelian dan lelang

- Properti tanpa pemilik dapat dibeli dengan harga yang tertera.
- Menolak pembelian membuka lelang berurutan di antara investor aktif.
- Penawaran harus lebih tinggi dari penawaran saat ini dan memenuhi kenaikan minimum.
- Peserta yang lewat keluar dari lelang.
- Penawar tertinggi menang setelah semua peserta lain lewat.
- Jika semua peserta lewat, properti tetap tanpa pemilik.

### Bangunan

- Rumah hanya dapat dibangun setelah seluruh properti dalam satu grup warna dimiliki dan tidak ada yang digadaikan.
- Bangunan harus merata dalam grup.
- Empat rumah berikutnya meningkatkan properti menjadi hotel.
- Persediaan bank dibatasi dan ditampilkan di panel pemain.
- Penjualan bangunan mengikuti urutan kebalikan dan mengembalikan sebagian biaya.
- Hotel yang dijual mengembalikan empat rumah jika bank masih memiliki persediaannya.

### Gadai dan pertukaran

- Gadai memberi uang tunai sesuai nilai gadai properti.
- Menebus gadai membayar nilai gadai ditambah bunga.
- Bangunan dalam grup harus dijual sebelum properti dapat digadaikan.
- Pertukaran dapat berisi uang, properti tanpa bangunan di grupnya, dan kartu bebas penjara.
- Uang hanya boleh berasal dari satu sisi penawaran.
- Pengirim harus mengonfirmasi penawaran, lalu penerima menerima atau menolak.

### Penjara

- Pemain yang ditahan dapat mencoba dadu ganda, membayar denda, atau memakai kartu bebas penjara.
- Dadu ganda membebaskan pemain tanpa denda.
- Setelah tiga percobaan gagal, denda wajib dibayar lalu pemain bergerak sesuai dadu.
- Jika saldo tidak cukup, permainan masuk ke penyelesaian utang.

### Kartu

- Dua dek terpisah: **Sinyal Kesempatan** dan **Arsip Kota**.
- Masing-masing dek berisi 16 kartu, diacak sekali di awal permainan.
- Isi kartu hanya ditampilkan sebagai sandi angka sampai pemain mengetik jawaban dekripsi yang benar.
- Jawaban salah tidak menjalankan efek apa pun.
- Setelah jawaban benar, pemain tetap harus menekan tombol untuk menerapkan efek.
- Efek dijalankan tepat satu kali dari data efek terstruktur, bukan dari teks yang terlihat.
- Mode bantuan nonaktif secara default. Opsi “Tampilkan jawaban (guru/demo)” juga nonaktif secara default.

Jenis efek kartu yang didukung: pindah ke petak tertentu, bergerak relatif, pindah ke stasiun/utilitas terdekat, menerima dari bank, membayar ke bank, menerima dari setiap pemain, membayar kepada setiap pemain, masuk penjara, menyimpan kartu bebas penjara, dan biaya perbaikan per rumah/hotel.

### Kebangkrutan dan pemenang

- Pemain yang tidak mampu membayar dapat menjual bangunan, menggadaikan properti, atau menyatakan bangkrut.
- Jika kreditur adalah pemain, sisa uang, properti, dan kartu bebas penjara berpindah kepada kreditur.
- Jika kreditur adalah bank, uang tunai diselesaikan dan properti kembali tanpa pemilik; status gadai dibersihkan.
- Permainan berakhir ketika hanya satu pemain solven yang tersisa. Pemain itu menjadi pemenang.
- Jika tidak ada pemain solven yang tersisa, permainan berakhir tanpa pemenang.

---

## Sandi yang dipakai aplikasi

Alfabet: `A=0, B=1, …, Z=25`, modulus 26.

Kunci pengembangan saat ini:

```text
f(x) = (5x + 8) mod 26
g(x) = (7x + 3) mod 26
E(x) = g(f(x)) = (9x + 7) mod 26
E⁻¹(y) = f⁻¹(g⁻¹(y)) = (3y + 5) mod 26
```

Kode tampilan memakai offset `+1`, sehingga nilai 0 ditampilkan sebagai `08`, nilai 1 sebagai `09`, dan seterusnya. Contoh: `A` → indeks 0 → nilai sandi 7 → kode `08`.

Format teks sandi:

- Setiap huruf menjadi dua digit, misalnya `08 15 06`.
- Tanda `/` memisahkan kata.
- Angka asli dipertahankan di dalam tanda kurung siku, misalnya `[200]`, agar tidak dianggap kode huruf.
- Tanda baca dipertahankan.
- Saat memeriksa jawaban, huruf besar/kecil, spasi berlebih, dan tanda baca diabaikan; makna kalimat tetap harus benar.
- Kunci diuji bolak-balik untuk seluruh 26 huruf sebelum permainan dimulai.

Yang disandikan: nama petak dan isi kartu. Yang tetap terbaca: label antarmuka, harga, sewa, saldo, dadu, pajak, dan nilai aturan lainnya.

---

## Nilai aturan yang benar-benar dipakai

Nilai ini berasal dari `data/edition-profile.json`:

| Aturan | Nilai |
|---|---|
| Pemain | 2–8 lokal |
| Saldo awal | 1.500 CR |
| Gaji Gerbang Kota | 200 CR |
| Denda penjara | 50 CR |
| Percobaan penjara maksimum | 3 |
| Persediaan rumah | 32 |
| Persediaan hotel | 12 |
| Rumah per properti sebelum hotel | 4 |
| Bunga tebus gadai | 10% |
| Kenaikan minimum lelang | 10 CR |
| Jackpot Taman Netral | Tidak ada |
| Kondisi akhir | Pemain solven terakhir |

---

## Simpan lokal

- Save permainan: `localStorage` dengan kunci `encrypted-monopoly.save.v1`.
- Pengaturan: `encrypted-monopoly.settings.v1`.
- Penanda prolog: `encrypted-monopoly.prologue-seen.v1`.
- Skema save saat ini: versi `1`.

Save divalidasi sebelum dimuat. Validasi menolak, antara lain:

- versi skema yang tidak dikenal;
- profil edisi yang tidak cocok;
- kunci sandi yang tidak valid;
- jumlah pemain atau token yang tidak sesuai;
- kartu yang hilang, duplikat, atau berada di dek yang salah;
- jumlah rumah/hotel yang tidak sesuai persediaan bank;
- fase dan keputusan tertunda yang tidak konsisten.

Save hanya tersedia di browser dan origin yang sama. Tidak ada ekspor/impor berkas save. Save dapat dihapus lewat **Pengaturan → Hapus Save Lokal**.

---

## Pengaturan yang tersedia

- **Mode bantuan dekripsi** — menampilkan tombol bantuan pada dialog kartu. Nonaktif secara default.
- **Tampilkan jawaban (guru/demo)** — membuka jawaban setelah bantuan dipilih. Nonaktif secara default.
- **Tampilkan teks asli papan** — menampilkan nama asli petak di panel pemeriksa dan dialog. Nonaktif secara default.
- **Kurangi animasi** — melewati animasi dadu dan perpindahan token.

Perubahan pengaturan langsung disimpan dan diterapkan.

---

## Struktur proyek

```text
index.html                  Kerangka layar dan modal
css/                        Tema, tata letak, papan, komponen, responsif
data/                       Profil edisi, papan, properti, grup, token, kartu, cerita, kunci
src/main.js                 Bootstrap: muat data, validasi, buat cipher, mulai aplikasi
src/app.js                  Navigasi layar, autosave, aksi engine, dialog
src/screens.js              Render menu, prolog, dan setup
src/core/                   State, mesin permainan, gerak, ekonomi, properti, bangunan,
                            gadai, lelang, penjara, kebangkrutan, kartu, pertukaran
src/crypto/                 Matematika modular, alfabet, enkripsi, dekripsi, validasi kunci
src/storage/                Save lokal dan validasi save
src/ui/                     Papan, panel, modal, toast, dialog, presenter, ikon
src/utils/                  Format uang, RNG, validator
tests/                      98 tes Node built-in test runner
tools/dev-server.js         Server statis tanpa dependensi
```

---

## Kustomisasi data

Semua konten permainan dapat diubah lewat JSON:

- `data/board-spaces.json` — 40 petak dan tipe petaknya.
- `data/properties.json` — harga, sewa, nilai gadai, biaya rumah, grup.
- `data/groups.json` — nama dan warna grup.
- `data/tokens.json` — token dan warna.
- `data/chance-cards.json` — 16 kartu Sinyal Kesempatan.
- `data/community-chest-cards.json` — 16 kartu Arsip Kota.
- `data/story.json` — teks menu, prolog, dek, penjara, kebangkrutan, dan pemenang.
- `data/edition-profile.json` — nilai aturan.
- `data/encryption-config.json` — fungsi `f`, `g`, urutan komposisi, offset, dan status kunci.

Jika mengubah kunci, ubah `functionF`, `functionG`, dan `approved`. Setelah kunci final disepakati, set `approved: true` agar peringatan mode pengembangan tidak lagi muncul. Tes crypto saat ini mengunci nilai kunci `dev-key-01`, jadi mengganti kunci juga memerlukan penyesuaian tes.

Data divalidasi saat aplikasi dimuat. Jika ada field wajib yang hilang, indeks petak yang tidak lengkap, kartu tanpa efek, atau kunci yang tidak reversibel, aplikasi berhenti di layar fatal dengan daftar kesalahan.

---

## Batasan dan item provisional

- **Kunci sandi masih kunci pengembangan** dan belum disetujui guru. Jangan menganggapnya aman untuk data nyata.
- **Data edisi bersifat provisional.** Nilai memakai baseline klasik standar 40 petak, sedangkan nama wilayah adalah nama orisinal Cryptonia, bukan klaim data resmi suatu edisi fisik.
- **Aturan penjualan hotel saat bank tidak punya 4 rumah** memakai aturan provisional: hotel dilikuidasi bersama empat rumah virtualnya pada `2,5 × biaya rumah`. Ini bukan aturan edisi resmi yang terverifikasi.
- **Kebangkrutan kepada bank** mengosongkan kepemilikan properti dan menghapus status gadai. Perlakuan ini provisional dan didokumentasikan di kode.
- **Tidak ada multiplayer jaringan, akun, AI, atau backend.** Semua pemain bermain bergiliran di satu perangkat.
- **Cerita hanya lapisan tampilan.** Tidak ada misi, dialog bercabang, atau mekanik tambahan dari cerita.
- **Tidak ada ekspor/impor save.** Save terikat pada browser dan origin.
- **Tidak ada undo.** Keputusan yang sudah diterapkan harus diselesaikan lewat aturan permainan.
- **Belum ada pengujian otomatis browser yang tersimpan di repositori.** Pemeriksaan headless manual (Chrome DevTools Protocol) mencakup menu → prolog → setup → mulai permainan → lempar dadu → beli properti → gadai lewat dialog aset → dekripsi dan terapkan kartu → muat ulang dan lanjutkan save, tanpa exception maupun error konsol.

---

## Troubleshooting

### Layar loading tidak selesai

1. Pastikan aplikasi dijalankan lewat `npm start`, bukan dengan membuka `index.html` langsung.
2. Buka `http://localhost:5173`, bukan `file:///...`.
3. Buka konsol browser. Jika data tidak valid, layar fatal akan menampilkan daftar kesalahan.
4. Jika modul gagal dimuat, tunggu beberapa detik; halaman akan menampilkan petunjuk server lokal secara otomatis.

### Save tidak dapat dilanjutkan

Save divalidasi ketat. Jika data permainan diubah setelah save dibuat, save lama bisa ditolak. Hapus save lewat Pengaturan, lalu mulai permainan baru.

### Kunci sandi berubah

Mengubah `data/encryption-config.json` mengubah semua ciphertext. Save lama yang memakai kunci berbeda tetap membawa konfigurasi kuncinya sendiri, tetapi data dan tes sebaiknya diperiksa ulang.
