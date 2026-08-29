export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const siswa = await prisma.siswa.findUnique({ where: { userId: session.user.id } })
  if (!siswa) {
    throw createError({ statusCode: 404, statusMessage: 'Data murid tidak ditemukan' })
  }

  const requests = await prisma.absensiRequest.findMany({
    where: {
      siswaId: siswa.id,
      status: 'HADIR'
    },
    include: {
      sesi: {
        include: {
          jadwal: {
            select: {
              mapel: true,
              kelas: { select: { nama: true } },
              guru: { select: { nama: true } }
            }
          },
          ratings: {
            where: { siswaId: siswa.id }
          }
        }
      }
    },
    orderBy: { scannedAt: 'desc' }
  })

  const sessions = requests.map(r => ({
    sesiId: r.sesiId,
    tanggal: r.sesi.tanggal,
    mapel: r.sesi.jadwal.mapel,
    kelas: r.sesi.jadwal.kelas.nama,
    guru: r.sesi.jadwal.guru.nama,
    rating: r.sesi.ratings[0] || null
  }))

  const rated = sessions.filter(s => s.rating)
  const totalRating = rated.reduce((sum, s) => sum + (s.rating?.rating || 0), 0)

  return {
    sessions,
    stats: {
      totalDirate: rated.length,
      totalHadir: sessions.length,
      rataRata: rated.length ? totalRating / rated.length : null
    }
  }
})
