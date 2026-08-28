# Plan: Wali Kelas — Bulk Ubah Status Kehadiran Murid per Hari

## Tujuan
Hanya PTK yang merupakan **wali kelas** (`Kelas.waliKelasId === user.id`) yang dapat mengubah status kehadiran satu atau beberapa murid di kelasnya **untuk satu tanggal utuh** (bukan per-sesi/per-mapel). Status yang dapat di-set: `HADIR`, `SAKIT`, `IZIN`, `ALPHA`. Berlaku untuk tanggal hari ini maupun tanggal lampau (koreksi).

## Konfirmasi Pengguna
- **Scope**: Bulk per-hari per-murid (bukan per-sesi). Wali kelas memilih tanggal + kelas (otomatis = kelas yang diwali), lalu memilih murid → status → simpan.
- **Pemicu**: Tambah CTA "Atur Kehadiran" di halaman `/absensi/izin` dan/atau `/absensi` jika user adalah wali kelas, dan dari daftar murid di halaman detail/riwayat.

## Boundaries & Otorisasi
- **Aktor yang diizinkan**: PTK dengan `role === 'GURU'` **dan** `Kelas.waliKelasId === user.id`. Bukan guru mapel biasa, bukan admin (admin tidak diikutsertakan di iterasi ini sesuai ruang lingkup PTK).
- **Objek yang diizinkan**: Siswa pada kelas yang diwali saja. Pengecekan di endpoint, bukan hanya di UI.
- **Bisa mengubah tanggal apa saja**: Hari ini dan tanggal lampau. Tanggal masa depan **ditolak** agar tidak merusak data.
- **Bisa mengubah semua status termasuk `HADIR`** untuk koreksi (mis. guru mapel sudah input HADIR, wali kelas koreksi jadi SAKIT). Pola ini mengikuti logika pada `izin/[id]/respon.post.ts:75-79` yang melewati sesi `SELESAI + HADIR`; **kita longgarkan**: wali kelas boleh override karena ini adalah koreksi administratif tingkat kelas.

## Data Flow
1. Frontend `app/pages/absensi/wali-kelas/kehadiran.vue` (atau modal di halaman izin) — wali kelas pilih:
   - **Kelas** (default: kelas yang diwali; jika >1, tampilkan dropdown)
   - **Tanggal** (date picker, maks = hari ini)
   - **Daftar murid** di kelas tersebut, masing-masing dengan dropdown status (Hadir/Sakit/Izin/Alpha) + input keterangan (opsional, max 255 char, sama seperti `sesi/[id].vue:259`)
   - **Catatan global harian** (opsional, disimpan ke `keterangan` di setiap request)
2. Klik **Simpan** → POST ke `/api/absensi/wali-kelas/kehadiran` dengan payload `{ tanggal, entries: [{ siswaId, status, keterangan? }] }`.
3. Endpoint:
   - Validasi `user.role === 'GURU'`
   - Validasi ada `Kelas` di mana `waliKelasId === user.id` **dan** `kelasId` dari entries
   - Validasi `tanggal <= today`
   - Validasi setiap `siswaId` ada di kelas yang diwali
   - Dalam `$transaction`:
     - Ambil semua `SesiAbsensi` di tanggal tsb untuk kelas tsb
     - Untuk setiap `(sesi, entry)`: `upsert` `AbsensiRequest` dengan `status`, `keterangan`, `approvedBy = user.id`, `approvedAt = now`, `scannedAt = now` (jika baru)
     - Catatan global (jika ada) akan di-merge: pakai catatan per-murid jika ada, kalau tidak pakai catatan global
   - Return ringkasan `{ sesiUpdated, totalEntries }`
4. Frontend refresh data + tampilkan toast sukses.

## Skema DB
Tidak ada migrasi skema. Tabel `AbsensiRequest` sudah mendukung: `status`, `keterangan`, `approvedBy`, `approvedAt`. Unique `(sesiId, siswaId)` cocok untuk `upsert`.

## API & File yang Akan Ditambah/Diubah

### Backend (tambah)
- `server/api/absensi/wali-kelas/kehadiran.post.ts`
  - Validasi: role GURU, wali kelas dari kelas yang dimaksud, tanggal valid (≤ hari ini, parse pakai `todayDate()` dari `server/utils/sesi.ts`)
  - Schema Zod: `{ tanggal: ISO date string, kelasId: number, entries: [{ siswaId, status: enum, keterangan?: string|null }] }`
  - Otorisasi: `prisma.kelas.findFirst({ where: { id: kelasId, waliKelasId: user.id } })` — jika null → 403
  - Transaksi: upsert per `(sesiId, siswaId)` untuk semua sesi di tanggal tsb

- `server/api/absensi/wali-kelas/kelas-saya.get.ts` (helper, opsional tapi direkomendasikan)
  - Return list `Kelas` di mana user adalah wali kelas, lengkap dengan `siswa: { id, nisn, nama }` terurut by nama
  - Dipakai oleh frontend untuk populate dropdown & daftar murid
  - Menghindari frontend panggil banyak endpoint

### Frontend (tambah)
- `app/pages/absensi/wali-kelas/kehadiran.vue`
  - Layout: `PTKLayout` (lihat `app/pages/absensi/sesi/[id].vue:139` untuk pola)
  - Section:
    1. Pilih kelas (dropdown; jika 1, auto-select & hide)
    2. Pilih tanggal (date input, `max = today`)
    3. Tabel murid (pola mirip `sesi/[id].vue:216-283` tapi **tanpa** checkbox dan **tanpa** kolom scan; cukup nama + NISN + dropdown status + input keterangan)
    4. Catatan global harian (textarea, max 255 char, di-apply ke semua entry yang tidak punya catatan sendiri — **atau lebih sederhana**: catatan global override catatan per-murid, dikonfirmasi di pertanyaan terpisah)
    5. Tombol Simpan (primary, dengan spinner)
  - Fetch helper pakai `useFetch` + `refresh`
  - Tampilkan status count summary (Hadir/Sakit/Izin/Alpha) di atas tabel, seperti `sesi/[id].vue:203-210`
  - Tampilkan info tanggal sesi (jumlah sesi di tanggal tsb untuk kelas tsb) sebagai konteks: "Tanggal ini memiliki N sesi untuk kelas X"

- (Sosialisasi) Tambah CTA di `app/pages/absensi/index.vue` dan/atau `app/pages/absensi/izin/index.vue`:
  - Hanya muncul jika `data.isWaliKelas === true`
  - Misal link/kartu: "Atur Kehadiran Kelas" → `/absensi/wali-kelas/kehadiran`
  - Style konsisten dengan card/CTA yang sudah ada (rounded-2xl, border, hover, dsb.)

## Komponen/Util yang Dipakai Ulang
- `PTKLayout`, `PageHeader`, `Notification`, `BaseBadge`, `LoadingSkeleton` (cek di `app/components` — sudah dipakai di `sesi/[id].vue` & `izin/index.vue`)
- `statusLabels`, `statusBadgeVariant`, `statusDotColor` dari `app/utils/absensi.ts`
- Pola upsert dari `server/api/absensi/izin/[id]/respon.post.ts:45-95`
- Pola UI form dari `app/pages/absensi/sesi/[id].vue:36-66` (state `entries` Map)

## Validasi & Edge Cases
1. **Wali kelas > 1 kelas** (jarang tapi mungkin): tampilkan dropdown pilih kelas. Endpoint harus menerima `kelasId` dan validasi waliKelasId user pada kelas tsb.
2. **Tanggal tanpa sesi** (weekend/libur): tetap izinkan simpan. Tidak ada baris sesi → tidak ada baris `AbsensiRequest` yang di-upsert. Frontend tampilkan info "Tidak ada sesi di tanggal ini untuk kelas X. Status yang disimpan tidak akan muncul di rekap per-sesi manapun." (Catatan: perlu konfirmasi — apakah ini perilaku yang diinginkan, atau tolak simpan?)
3. **Siswa yang sudah `HADIR` di sesi SELESAI** (override): izinkan (lihat keputusan Boundaries).
4. **Murid yang sedang `PENDING` di sesi AKTIF**: tetap di-override (wali kelas berhak). Status sesi tidak relevan di level ini.
5. **Tanggal masa depan**: tolak dengan 400 "Tidak dapat mengatur kehadiran untuk tanggal yang akan datang".
6. **Tidak ada entry yang dikirim**: tolak dengan 400 "Pilih minimal satu murid".
7. **Kosongkan status (kembalikan ke "Belum Absen")**: **tidak didukung** di iterasi pertama — tidak ada kolom di `AbsensiRequest` untuk menandai "tidak ada keputusan". Status di DB akan selalu salah satu dari 4 nilai final. Jika ingin "kosongkan", harus hapus baris `AbsensiRequest` (lihat Open Question).

## Rollout
- Tidak butuh migrasi DB.
- Tidak butuh perubahan izin/role.
- Bisa langsung dipakai setelah deploy.
- Opsional: tambahkan `tanggal` filter di `app/pages/absensi/riwayat/index.vue` (sudah ada `exportBulan`/`exportTahun`) untuk melihat koreksi wali kelas — tidak wajib di iterasi ini.

## Validasi Uji (test plan)
1. Login sebagai wali kelas → akses `/absensi/wali-kelas/kehadiran` → set 2 murid SAKIT, 1 murid IZIN untuk tanggal kemarin → Simpan.
2. Cek di `prisma.absensiRequest.findMany({ where: { siswaId: { in: [...] }, sesi: { tanggal: kemarin } } })` → 3 entri baru (atau updated) dengan `approvedBy = waliKelasId`, `status` sesuai.
3. Buka rekap `/absensi/riwayat` → status SAKIT/IZIN untuk mapel di tanggal tsb muncul di rekap.
4. Uji sebagai guru mapel (bukan wali kelas) → akses endpoint langsung via curl/Postman → 403.
5. Uji set tanggal besok → 400.
6. Uji set siswa dari kelas lain (bukan diwali) → 403 atau filter 400.
7. Uji set wali kelas dari kelas berbeda → 403.
8. Uji set semua 4 status (HADIR, SAKIT, IZIN, ALPHA) → cek DB.

## Open Questions
1. **Catatan global vs catatan per-murid**: saat simpan, kalau wali kelas isi catatan harian tapi TIDAK isi catatan per-murid, apakah catatan harian jadi fallback? (Rekomendasi: ya, fallback, karena konteksnya satu hari.)
2. **Hapus/reset kehadiran**: apakah wali kelas boleh "membersihkan" status (kembalikan ke "Belum Absen")? (Rekomendasi: tidak di iterasi pertama. Status final adalah 4 enum yang sudah ada. Tambahkan nanti jika diminta.)
3. **Lokasi CTA**: cukup di `/absensi` (home) atau juga di `/absensi/izin`? (Rekomendasi: keduanya, dengan primary CTA di `/absensi` home agar mudah ditemukan.)
4. **Periode editable**: apakah hanya hari ini, atau sampai N hari ke belakang? (Rekomendasi: bebas pilih tanggal apapun ≤ hari ini, tidak ada batasan mundur. Cocok untuk koreksi.)
