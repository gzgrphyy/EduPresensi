import prisma from './prisma'
import { getAbsensiSettings } from './pengaturan'

export const TOLERANSI_MENIT = 10

export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + (m || 0)
}

export function currentTimeHHMM(now: Date = new Date()): string {
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

export function todayDate(): Date {
  return new Date(new Date().toISOString().split('T')[0])
}

export function hariIni(now: Date = new Date()): string {
  const days = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU']
  return days[now.getDay()]
}

export async function getOrCreateSesi(jadwalId: number, tanggal: Date) {
  const existing = await prisma.sesiAbsensi.findUnique({
    where: { jadwalId_tanggal: { jadwalId, tanggal } }
  })
  if (existing) return existing
  return prisma.sesiAbsensi.create({
    data: { jadwalId, tanggal, status: 'AKTIF' }
  })
}

export async function finalizeSesi(sesiId: number) {
  const sesi = await prisma.sesiAbsensi.findUnique({
    where: { id: sesiId },
    include: {
      jadwal: { include: { kelas: { include: { siswa: { select: { id: true } } } } } },
      requests: { select: { siswaId: true, status: true } }
    }
  })
  if (!sesi || sesi.status === 'SELESAI') return sesi

  const now = new Date()
  const guruId = sesi.jadwal.guruId

  const pendingIds = sesi.requests.filter(r => r.status === 'PENDING').map(r => r.siswaId)
  if (pendingIds.length > 0) {
    await prisma.absensiRequest.updateMany({
      where: { sesiId, siswaId: { in: pendingIds } },
      data: { status: 'HADIR', approvedBy: guruId, approvedAt: now }
    })
  }

  const requestedIds = new Set(sesi.requests.map(r => r.siswaId))
  const missingIds = sesi.jadwal.kelas.siswa
    .filter(s => !requestedIds.has(s.id))
    .map(s => s.id)

  if (missingIds.length > 0) {
    const approvedIzins = await prisma.izin.findMany({
      where: { siswaId: { in: missingIds }, tanggal: sesi.tanggal, status: 'DISETUJUI' },
      select: { siswaId: true, jenis: true }
    })
    const izinMap = new Map(approvedIzins.map(i => [i.siswaId, i.jenis]))

    const toCreate = missingIds.map((siswaId) => {
      const jenis = izinMap.get(siswaId)
      const status = jenis === 'SAKIT' ? 'SAKIT' : jenis === 'IZIN' ? 'IZIN' : 'ALPHA'
      return {
        sesiId,
        siswaId,
        status,
        scannedAt: now,
        approvedBy: guruId,
        approvedAt: now
      }
    })

    await prisma.absensiRequest.createMany({ data: toCreate })
  }

  return prisma.sesiAbsensi.update({
    where: { id: sesiId },
    data: { status: 'SELESAI', ditutupPada: now },
    include: {
      jadwal: {
        include: {
          kelas: { select: { id: true, nama: true } },
          ruangan: { select: { id: true, nama: true } }
        }
      }
    }
  })
}

export async function finalizeExpiredSesi() {
  const settings = await getAbsensiSettings()
  if (!settings.autoTutupSesi) {
    return 0
  }

  const now = new Date()
  const today = todayDate()
  const tNow = timeToMinutes(currentTimeHHMM(now))

  const activeSesi = await prisma.sesiAbsensi.findMany({
    where: { status: 'AKTIF' },
    select: { id: true, tanggal: true, jadwal: { select: { jamSelesai: true } } }
  })

  const expiredIds = activeSesi
    .filter((s) => {
      const d = new Date(s.tanggal.toISOString().split('T')[0]).getTime()
      const todayT = today.getTime()
      if (d < todayT) return true
      if (d > todayT) return false
      return tNow > timeToMinutes(s.jadwal.jamSelesai) + TOLERANSI_MENIT
    })
    .map(s => s.id)

  for (const id of expiredIds) {
    await finalizeSesi(id)
  }
  return expiredIds.length
}

export async function checkinSiswaRuangan(
  siswa: { id: number; kelasId: number },
  ruanganId: number
) {
  const now = new Date()
  const today = todayDate()
  const hari = hariIni(now) as any

  const jadwals = await prisma.jadwalPelajaran.findMany({
    where: { ruanganId, hari, kelasId: siswa.kelasId },
    include: {
      sesi: { where: { tanggal: today } },
      kelas: { select: { id: true, nama: true } },
      ruangan: { select: { id: true, nama: true } },
      guru: { select: { id: true, nama: true } }
    },
    orderBy: { jamMulai: 'asc' }
  })

  if (jadwals.length === 0) {
    return { success: false, reason: 'NO_SCHEDULE' }
  }

  const sesiIds = jadwals.flatMap(j => j.sesi.map(s => s.id))
  if (sesiIds.length > 0) {
    const already = await prisma.absensiRequest.findFirst({
      where: { siswaId: siswa.id, sesiId: { in: sesiIds } }
    })
    if (already) {
      return { success: false, reason: 'ALREADY_SCANNED' }
    }
  }

  const hasActive = jadwals.some(j => j.sesi.length === 0 || j.sesi.some(s => s.status === 'AKTIF'))
  if (!hasActive) {
    return { success: false, reason: 'ALL_DONE' }
  }

  const tNow = timeToMinutes(currentTimeHHMM(now))
  const currentJadwal = jadwals.find((j) => {
    const start = timeToMinutes(j.jamMulai) - TOLERANSI_MENIT
    const end = timeToMinutes(j.jamSelesai) + TOLERANSI_MENIT
    return tNow >= start && tNow <= end
  }) || null

  let createdCount = 0
  let alreadyScanned = true

  for (const j of jadwals) {
    let sesi = j.sesi.find(s => s.status === 'AKTIF') || j.sesi[0] || null
    if (sesi && sesi.status === 'SELESAI') continue
    if (!sesi) {
      sesi = await prisma.sesiAbsensi.create({
        data: { jadwalId: j.id, tanggal: today, status: 'AKTIF' }
      })
    }
    const existing = await prisma.absensiRequest.findUnique({
      where: { sesiId_siswaId: { sesiId: sesi.id, siswaId: siswa.id } }
    })
    if (!existing) {
      await prisma.absensiRequest.create({
        data: { sesiId: sesi.id, siswaId: siswa.id, scannedAt: now, status: 'PENDING' }
      })
      createdCount++
      alreadyScanned = false
    }
  }

  const target = currentJadwal || jadwals[0]
  const info = target
    ? {
        mapel: target.mapel,
        kelas: target.kelas.nama,
        ruangan: target.ruangan.nama,
        jamMulai: target.jamMulai,
        jamSelesai: target.jamSelesai,
        guru: target.guru.nama
      }
    : null

  return {
    success: true,
    alreadyScanned,
    createdCount,
    jumlahSesi: jadwals.length,
    tanggal: today.toISOString().split('T')[0],
    info
  }
}

export async function checkinPtkRuangan(
  user: { id: number },
  ruanganId: number
) {
  const now = new Date()
  const today = todayDate()
  const hari = hariIni(now) as any

  const jadwals = await prisma.jadwalPelajaran.findMany({
    where: { ruanganId, hari, guruId: user.id },
    include: {
      sesi: { where: { tanggal: today } },
      kelas: { select: { id: true, nama: true } },
      ruangan: { select: { id: true, nama: true } }
    },
    orderBy: { jamMulai: 'asc' }
  })

  if (jadwals.length === 0) {
    return { success: false, reason: 'NO_SCHEDULE' }
  }

  let updatedCount = 0
  let alreadyScanned = true

  for (const j of jadwals) {
    let sesi = j.sesi.find(s => s.status === 'AKTIF') || j.sesi[0] || null
    if (sesi && sesi.status === 'SELESAI') continue
    if (!sesi) {
      sesi = await prisma.sesiAbsensi.create({
        data: { jadwalId: j.id, tanggal: today, status: 'AKTIF' }
      })
    }
    const upd = await prisma.sesiAbsensi.updateMany({
      where: { id: sesi.id, ptkScanBy: null },
      data: { ptkScanAt: now, ptkScanBy: user.id }
    })
    if (upd.count > 0) {
      updatedCount++
      alreadyScanned = false
    }
  }

  return {
    success: true,
    alreadyScanned,
    updatedCount,
    jumlahSesi: jadwals.length,
    jadwals: jadwals.map(j => ({
      id: j.id,
      mapel: j.mapel,
      jamMulai: j.jamMulai,
      jamSelesai: j.jamSelesai,
      kelas: j.kelas.nama,
      ruangan: j.ruangan.nama
    }))
  }
}