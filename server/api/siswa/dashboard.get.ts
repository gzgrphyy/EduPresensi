export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const siswa = await prisma.siswa.findUnique({
    where: { userId: session.user.id },
    include: { kelas: { select: { id: true, nama: true } } }
  })
  if (!siswa) {
    throw createError({ statusCode: 404, statusMessage: 'Data murid tidak ditemukan' })
  }

  const now = new Date()
  const today = todayDate()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  await finalizeExpiredSesi()

  const [todayRequests, monthHadir, monthSakit, monthIzin, monthAlpha, recentHistory, todayJadwalCount] = await Promise.all([
    prisma.absensiRequest.findMany({
      where: { siswaId: siswa.id, sesi: { tanggal: today } },
      include: {
        sesi: {
          select: {
            isGuruBerhalangan: true,
            petugasPiketNama: true,
            jadwal: {
              include: {
                ruangan: { select: { id: true, nama: true } },
                kelas: { select: { id: true, nama: true } },
                guru: { select: { id: true, nama: true } }
              }
            }
          }
        }
      },
      orderBy: { scannedAt: 'desc' }
    }),
    prisma.absensiRequest.count({
      where: {
        siswaId: siswa.id,
        status: 'HADIR',
        sesi: { tanggal: { gte: monthStart } }
      }
    }),
    prisma.absensiRequest.count({
      where: {
        siswaId: siswa.id,
        status: 'SAKIT',
        sesi: { tanggal: { gte: monthStart } }
      }
    }),
    prisma.absensiRequest.count({
      where: {
        siswaId: siswa.id,
        status: 'IZIN',
        sesi: { tanggal: { gte: monthStart } }
      }
    }),
    prisma.absensiRequest.count({
      where: {
        siswaId: siswa.id,
        status: 'ALPHA',
        sesi: { tanggal: { gte: monthStart } }
      }
    }),
    prisma.absensiRequest.findMany({
      where: { siswaId: siswa.id },
      include: {
        sesi: {
          select: {
            tanggal: true,
            isGuruBerhalangan: true,
            petugasPiketNama: true,
            jadwal: {
              select: {
                mapel: true,
                kelas: { select: { nama: true } }
              }
            }
          }
        }
      },
      orderBy: { scannedAt: 'desc' },
      take: 5
    }),
    prisma.jadwalPelajaran.count({
      where: { kelasId: siswa.kelasId, hari: hariIni(now) as any }
    })
  ])

  let todayStatus: {
    state: 'PRESENT' | 'PENDING' | 'ALPHA' | 'NOT_YET' | 'NO_SESSION'
    status?: string
    scannedAt?: string
    mapel?: string
    kelas?: string
    ruangan?: string
    jamMulai?: string
    jamSelesai?: string
    isGuruBerhalangan?: boolean
    petugasPiketNama?: string | null
  }

  if (todayRequests.length > 0) {
    const tNow = timeToMinutes(currentTimeHHMM(now))
    const inWindow = todayRequests.find((r) => {
      const j = r.sesi.jadwal
      const t = tNow
      return t >= timeToMinutes(j.jamMulai) - TOLERANSI_MENIT && t <= timeToMinutes(j.jamSelesai) + TOLERANSI_MENIT
    })
    const latest = inWindow || todayRequests[0]
    const status = latest.status
    todayStatus = {
      state: status === 'ALPHA' ? 'ALPHA' : status === 'PENDING' ? 'PENDING' : 'PRESENT',
      status,
      scannedAt: latest.scannedAt.toISOString(),
      mapel: latest.sesi.jadwal.mapel,
      kelas: latest.sesi.jadwal.kelas.nama,
      ruangan: latest.sesi.jadwal.ruangan.nama,
      jamMulai: latest.sesi.jadwal.jamMulai,
      jamSelesai: latest.sesi.jadwal.jamSelesai,
      isGuruBerhalangan: latest.sesi.isGuruBerhalangan,
      petugasPiketNama: latest.sesi.petugasPiketNama
    }
  } else {
    todayStatus = {
      state: todayJadwalCount === 0 ? 'NO_SESSION' : 'NOT_YET',
      status: undefined
    }
  }

  return {
    siswa: {
      id: siswa.id,
      nama: siswa.nama,
      kelas: siswa.kelas
    },
    todayStatus,
    monthStats: {
      hadir: monthHadir,
      sakit: monthSakit,
      izin: monthIzin,
      alpha: monthAlpha
    },
    recentHistory: recentHistory.map(h => ({
      id: h.id,
      tanggal: h.sesi.tanggal.toISOString(),
      mapel: h.sesi.jadwal.mapel,
      kelas: h.sesi.jadwal.kelas.nama,
      status: h.status,
      keterangan: h.keterangan,
      scannedAt: h.scannedAt,
      isGuruBerhalangan: h.sesi.isGuruBerhalangan,
      petugasPiketNama: h.sesi.petugasPiketNama
    }))
  }
})
