# Plan: Approval Kehadiran saat Guru Sakit/Absen — EduPresensi

## Latar Belakang
Sistem attendance saat ini mengharuskan approval dari PTK pengajar (guru mapel) untuk setiap sesi. Masalahnya: kalau guru pengajar sakit/absen, tidak ada yang approve, sehingga murid tidak bisa absen di sesi tersebut.

## Hierarki Approval (Fallback Chain)

```text
1. Guru Utama (mapel)
    ↓ jika sakit/absen
2. Pendamping (jika mapel tsb punya guru pendamping)
    ↓ jika tidak ada / tidak available
3. Guru Piket (approve manual, berdasarkan laporan lisan dari murid)
    ↓ jika piket juga tidak sempat/kosong
4. Admin / TU (safety net terakhir)
```

Catatan: **Wali Kelas tidak masuk ke alur ini** — perannya tetap seperti sekarang, yaitu approve izin/sakit murid (bukan approve kehadiran per sesi).

## Prinsip Desain

1. **First-approve-wins** — siapapun di hierarki yang approve duluan, itu yang tercatat sebagai approval final. Tidak ada urutan approval berjenjang yang ketat/wajib.
2. **Visibilitas sejak awal** — semua pihak berwenang (Guru, Pendamping jika ada, Guru Piket, Admin) bisa melihat sesi PENDING sejak sesi itu dibuat, tanpa delay/timeout dulu.
3. **Audit trail wajib** — setiap approval mencatat: siapa/role apa yang approve, dan waktu approve-nya.
4. **Pendamping tidak selalu ada** — kalau mapel tidak punya Pendamping, alur langsung skip ke Guru Piket.

## Guru Piket

- **Tidak perlu data jadwal piket** (`JadwalPiket`) di sistem — siapa yang piket hari itu diurus manual di luar sistem (seperti kebiasaan sekolah pada umumnya).
- **Alur pelaporan**:
  1. Sesi berjalan, guru mapel tidak hadir & tidak approve
  2. Perwakilan murid pergi ke ruang piket dan melapor secara lisan
  3. Petugas piket yang bertugas hari itu login ke sistem
  4. Sistem menampilkan semua sesi PENDING (dari seluruh kelas/sekolah)
  5. Petugas piket approve sesi yang dilaporkan
- **Sifat approval**: manual/trust-based — sistem tidak memverifikasi kebenaran laporan secara otomatis, mengandalkan proses fisik yang sudah lazim di sekolah.

## Akun Guru Piket

- **Keputusan: 1 akun bersama**, dipakai bergantian oleh siapapun yang sedang piket, ditempatkan di device/komputer ruang piket.
- Alasan: akun ini hanya dipakai untuk aksi approve, tidak menyimpan/menampilkan data sensitif pribadi (nilai, riwayat, dll), sehingga risiko keamanan berbagi akun relatif rendah.
- **Mitigasi audit trail**: tambahkan field opsional "Nama Petugas Piket" yang diisi manual (teks bebas atau dropdown) saat melakukan approve, supaya tetap ada jejak individu meski akunnya bersama.
- **Concurrent access**: kalau ada lebih dari 1 device di ruang piket login dengan akun yang sama secara bersamaan, approve harus idempotent — gunakan guard "hanya update jika status masih PENDING" untuk mencegah race condition.

## Yang Masih Perlu Diputuskan

- [ ] **Auto-close/timeout PENDING** — sesi yang sampai jam tertentu tidak di-approve siapapun, apakah otomatis jadi ALPHA atau tetap menunggu?
- [ ] **Dashboard Guru Piket** — karena bisa approve sesi dari seluruh sekolah (bukan cuma 1 kelas), perlu filter/pencarian by kelas atau mapel.
- [ ] Sumber data siapa itu "Pendamping" per mapel (setup manual di jadwal atau dinamis)
- [ ] Kasus Pendamping/Piket sudah approve, lalu guru asli ternyata masuk (telat, bukan sakit seharian) — apakah approval final atau bisa di-override
