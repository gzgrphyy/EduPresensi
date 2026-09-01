export default defineEventHandler(async (event) => {
  const today = new Date(new Date().toISOString().split('T')[0])

  const [
    jumlahPtk,
    jumlahMurid,
    jumlahKelas,
    totalRuangan,
    sesiAktifHariIni,
    semuaSesiHariIni,
  ] = await Promise.all([
    prisma.user.count({ where: { role: { in: ['GURU', 'PETUGAS_PIKET'] }, isActive: true } }),
    prisma.siswa.count(),
    prisma.kelas.count(),
    prisma.ruangan.count(),
    prisma.sesiAbsensi.findMany({
      where: { tanggal: today, status: 'AKTIF' },
      select: {
        id: true,
        jadwal: { select: { ruanganId: true, mapel: true, guru: { select: { nama: true } } } }
      }
    }),
    prisma.sesiAbsensi.findMany({
      where: { tanggal: today, status: 'SELESAI' },
      include: {
        requests: { select: { status: true } },
        jadwal: { select: { kelas: { select: { nama: true } } } }
      }
    }),
  ])

  const ruanganAktif = new Set(sesiAktifHariIni.map(s => s.jadwal.ruanganId)).size

  const hadir = semuaSesiHariIni.reduce((sum, s) => sum + s.requests.filter(r => r.status === 'HADIR').length, 0)
  const sakit = semuaSesiHariIni.reduce((sum, s) => sum + s.requests.filter(r => r.status === 'SAKIT').length, 0)
  const izin = semuaSesiHariIni.reduce((sum, s) => sum + s.requests.filter(r => r.status === 'IZIN').length, 0)
  const alpha = semuaSesiHariIni.reduce((sum, s) => sum + s.requests.filter(r => r.status === 'ALPHA').length, 0)
  const totalScan = hadir + sakit + izin + alpha
  const persentase = totalScan > 0 ? Number(((hadir / totalScan) * 100).toFixed(1)) : 0

  const monitoring = await Promise.all(
    (await prisma.ruangan.findMany({ select: { id: true, nama: true } })).map(async (r) => {
      const sesi = sesiAktifHariIni.find(s => s.jadwal.ruanganId === r.id)
      return {
        ruangan: r.nama,
        status: sesi ? 'Aktif' : 'Tidak Aktif',
        sesi: sesi?.jadwal.mapel || '-',
        ptk: sesi?.jadwal.guru.nama || '-'
      }
    })
  )

  const topAlpha = await prisma.absensiRequest.groupBy({
    by: ['siswaId'],
    where: {
      status: 'ALPHA',
      sesi: { tanggal: { gte: new Date(today.getFullYear(), today.getMonth(), 1) } }
    },
    _count: { status: true },
    orderBy: { _count: { status: 'desc' } },
    take: 5
  })

  const topAlphaDetail = await Promise.all(
    topAlpha.map(async (a) => {
      const siswa = await prisma.siswa.findUnique({
        where: { id: a.siswaId },
        select: { nama: true, kelas: { select: { nama: true } } }
      })
      return {
        nama: siswa?.nama || '-',
        kelas: siswa?.kelas.nama || '-',
        totalAlpha: a._count.status
      }
    })
  )

  const aktivitasTerbaru = (
    await prisma.sesiAbsensi.findMany({
      where: { tanggal: today },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        jadwal: {
          select: {
            mapel: true,
            kelas: { select: { nama: true } },
            guru: { select: { nama: true } }
          }
        }
      }
    })
  ).map(s => ({
    waktu: s.createdAt.toISOString().slice(11, 16),
    aksi: s.status === 'AKTIF' ? 'Sesi dibuka' : 'Sesi ditutup',
    detail: `${s.jadwal.mapel} - ${s.jadwal.kelas.nama} - ${s.jadwal.guru.nama}`
  }))

  return {
    jumlahPtk,
    jumlahMurid,
    jumlahKelas,
    totalRuangan,
    ruanganAktif,
    hadir,
    sakit,
    izin,
    alpha,
    persentase,
    topAlpha: topAlphaDetail,
    monitoring,
    aktivitasTerbaru
  }
})
