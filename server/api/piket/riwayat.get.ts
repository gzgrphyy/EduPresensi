export default defineEventHandler(async (event) => {
  const user = (await getUserSession(event)).user
  if (!user || (user.role !== 'ADMIN' && user.role !== 'GURU' && user.role !== 'PETUGAS_PIKET')) {
    throw createError({ statusCode: 403, statusMessage: 'Akses ditolak' })
  }

  const query = getQuery(event)
  const tanggal = (query.tanggal as string) || undefined

  const whereClause: any = {
    approvedByRole: { not: null }
  }

  if (tanggal) {
    const dateObj = new Date(tanggal + 'T00:00:00Z')
    whereClause.tanggal = dateObj
  }

  const sessions = await prisma.sesiAbsensi.findMany({
    where: whereClause,
    include: {
      jadwal: {
        include: {
          kelas: { select: { id: true, nama: true, _count: { select: { siswa: true } } } },
          guru: { select: { id: true, nama: true } },
          ruangan: { select: { id: true, nama: true } }
        }
      },
      requests: {
        select: { status: true }
      },
      guruBerhalangan: {
        select: { alasan: true, keterangan: true }
      }
    },
    orderBy: { tanggal: 'desc' },
    take: 100
  })

  return sessions.map(s => ({
    id: s.id,
    tanggal: s.tanggal.toISOString().split('T')[0],
    mapel: s.jadwal.mapel,
    jamMulai: s.jadwal.jamMulai,
    jamSelesai: s.jadwal.jamSelesai,
    kelas: s.jadwal.kelas.nama,
    guru: s.jadwal.guru.nama,
    ruangan: s.jadwal.ruangan.nama,
    petugasPiket: s.petugasPiketNama,
    totalSiswa: s.jadwal.kelas._count.siswa,
    hadir: s.requests.filter(r => r.status === 'HADIR').length,
    sakit: s.requests.filter(r => r.status === 'SAKIT').length,
    izin: s.requests.filter(r => r.status === 'IZIN').length,
    alpha: s.requests.filter(r => r.status === 'ALPHA').length,
    alasan: s.guruBerhalangan?.alasan || null
  }))
})
