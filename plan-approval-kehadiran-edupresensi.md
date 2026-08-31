# Plan: Approval Kehadiran saat Guru Sakit/Absen — EduPresensi

## 1. Latar Belakang & Masalah

Sistem attendance saat ini mengharuskan approval dari PTK pengajar (guru mapel)
untuk setiap sesi kehadiran murid. Masalahnya: kalau guru pengajar sakit/absen
dan tidak bisa masuk kelas, tidak ada yang approve, sehingga murid tidak bisa
menyelesaikan proses absensi di sesi tersebut.

## 2. Hierarki Approval (Fallback Chain)

1. Guru Utama (mapel)
    ↓ jika sakit/absen
2. Pendamping (jika mapel tsb memiliki guru pendamping)
    ↓ jika tidak ada / tidak available
3. Guru Piket (approve manual/administratif)
    ↓ jika piket juga tidak sempat/kosong
4. Admin / TU (safety net terakhir)

**Catatan:** Wali Kelas TIDAK masuk ke alur ini. Peran Wali Kelas tetap seperti
sekarang — approve izin/sakit murid — bukan approve kehadiran per sesi.

### Prinsip Desain
- **First-approve-wins**: siapapun di hierarki yang approve duluan, itu yang
  tercatat sebagai final. Tidak ada urutan approval berjenjang yang wajib diikuti
  ketat.
- **Visibilitas sejak awal**: semua pihak berwenang bisa melihat sesi PENDING
  sejak dibuka, tanpa delay/timeout.
- **Audit trail wajib**: setiap approval mencatat siapa/role apa yang approve
  dan waktu approve-nya.
- **Pendamping tidak selalu ada**: kalau mapel tidak punya Pendamping, alur
  langsung skip ke Guru Piket.

## 3. Dua Skenario Ketidakhadiran Guru

### Skenario A — Proaktif (Guru sempat lapor duluan)
Guru tahu tidak bisa masuk (H-1 malam atau pagi sebelum sekolah mulai) dan
melapor lewat sistem sebelum sesi dimulai.

Guru input "Tidak Masuk" (tanggal + alasan: Sakit/Izin/Dinas Luar)

→ Sistem menandai semua sesi guru itu pada tanggal tsb sebagai

"Guru Berhalangan"

→ Saat murid membuka absensi di sesi tsb, sistem otomatis mengarahkan

approval ke Guru Piket (skip menunggu guru utama)

→ Guru Piket melihat penanda jelas di dashboard: sesi mana saja yang

sudah dikonfirmasi guru berhalangan

### Skenario B — Reaktif (Sakit mendadak / lupa lapor)
Guru tidak sempat/lupa input apapun di sistem.

Sesi tetap terbuka normal, status PENDING menunggu approval

→ Guru tidak kunjung approve

→ Perwakilan murid pergi ke ruang piket, melapor secara lisan

→ Petugas piket login, mencari sesi PENDING yang dilaporkan

(tanpa penanda apapun dari sistem sebelumnya)

→ Petugas piket approve manual berdasarkan laporan lisan

**Kesimpulan:** Kedua skenario berujung ke Guru Piket sebagai approver akhir.
Bedanya hanya pada seberapa awal sistem "sudah tahu" — Skenario A memberi
penanda otomatis, Skenario B murni mengandalkan laporan manual.

## 4. Guru Piket

- Tidak perlu data jadwal piket (`JadwalPiket`) di sistem — siapa yang piket
  hari itu diatur manual di luar sistem, seperti kebiasaan sekolah pada umumnya.
- Approval bersifat manual/trust-based untuk Skenario B; untuk Skenario A,
  approval didasarkan pada penanda "Guru Berhalangan" yang sudah dikonfirmasi
  di sistem.

### Akun Guru Piket
- **Keputusan:** 1 akun bersama, dipakai bergantian oleh siapapun yang sedang
  bertugas piket, ditempatkan di device ruang piket.
- Alasan: akun ini hanya dipakai untuk aksi approve, tidak menyimpan/menampilkan
  data sensitif pribadi, sehingga risiko keamanan berbagi akun relatif rendah.
- **Mitigasi audit trail:** field opsional "Nama Petugas Piket" diisi manual
  (teks bebas atau dropdown daftar guru) saat approve, agar tetap ada jejak
  individu meski akunnya bersama.
- **Concurrency:** approve harus idempotent — guard "hanya update jika status
  masih PENDING" untuk mencegah race condition kalau lebih dari 1 device login
  bersamaan dengan akun yang sama.

## 5. Revisi Status oleh Guru Asli

Guru asli tetap bisa merevisi status kehadiran murid setelah di-approve oleh
Pendamping/Piket/Admin, **wajib disertai alasan singkat** (contoh: guru
ternyata masuk telat, atau ada koreksi data).

- Perubahan status setelah approval awal tercatat di audit trail sebagai:
  "diubah dari [status lama] jadi [status baru] oleh [guru], alasan: [alasan]"

---

## 6. Kebutuhan UI

### 6.1 Dashboard Guru — Fitur "Ajukan Tidak Masuk"
- Tombol/menu baru di Beranda Guru: **"Ajukan Tidak Masuk"**
- Form:
  - Pilih tanggal (bisa multi-tanggal / rentang tanggal)
  - Pilih alasan: dropdown (Sakit, Izin, Dinas Luar, Lainnya) + kolom teks
    tambahan jika "Lainnya"
  - Daftar sesi/mapel pada tanggal tsb ditampilkan sebagai checklist
    (default semua tercentang, guru bisa uncentang sesi yang tetap bisa
    dia hadiri)
  - Tombol "Kirim"
- Setelah submit: tampil badge/status di Beranda Guru: "Tidak Masuk pada
  [tanggal] — [alasan]" dengan opsi batal/edit sebelum tanggal tsb tiba

### 6.2 Dashboard Guru Piket
- Halaman khusus, terpisah dari dashboard Guru/Wali Kelas biasa
- List semua sesi PENDING dari **seluruh sekolah** (bukan cuma 1 kelas), dengan:
  - Filter by Kelas dan/atau Mapel (karena volume data lebih besar dari
    dashboard guru biasa)
  - Dua kategori visual berbeda:
    - **"Dikonfirmasi Berhalangan"** — sesi dengan penanda dari Skenario A
      (badge hijau/info, misal: "Guru [nama] — Sakit")
    - **"Menunggu Laporan"** — sesi PENDING biasa tanpa penanda apapun
      (kategori Skenario B, warna netral)
- Tombol "Approve" per sesi → muncul modal:
  - Daftar murid di sesi tsb dengan status default (bisa disesuaikan per
    murid: Hadir/Sakit/Izin/Alpha)
  - Field wajib: "Nama Petugas Piket" (input teks/dropdown)
  - Tombol "Konfirmasi Approve"

### 6.3 Detail Sesi — Badge & Tombol Revisi
- Di halaman "Detail Sesi", tambahkan badge status approval:
  - "Diapprove oleh: Guru Piket — [nama petugas]" (jika bukan guru asli
    yang approve)
  - "Direvisi oleh Guru [nama] pada [waktu]" (jika sudah direvisi), dengan
    alasan revisi bisa dilihat lewat tooltip/expand
- Tombol **"Revisi Kehadiran"** muncul kalau sesi di-approve oleh role
  selain guru asli:
  - Klik → modal per-murid, guru bisa ubah status individual
  - Field wajib: alasan revisi (dropdown singkat: "Koreksi kehadiran",
    "Guru masuk terlambat", "Lainnya" + teks bebas)

## 7. Yang Masih Perlu Diputuskan

- [ ] Auto-close/timeout sesi PENDING — kalau sampai jam tertentu tidak ada
      yang approve sama sekali (baik Skenario A maupun B), apakah otomatis
      jadi ALPHA atau tetap menunggu tanpa batas waktu?
- [ ] Sumber data siapa itu "Pendamping" per mapel — setup manual di data
      jadwal, atau bisa berubah dinamis?
- [ ] Notifikasi ke Guru Piket saat ada guru yang submit "Tidak Masuk"
      (Skenario A) — apakah perlu notif otomatis, atau piket baru tahu
      saat membuka dashboard sendiri?
