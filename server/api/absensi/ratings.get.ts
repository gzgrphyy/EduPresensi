export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  const user = session.user
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  // PTK (guru) can see their own sessions or admin can see all
  const whereClause = user.role === 'ADMIN' ? {} : { jadwal: { guruId: user.id } }

  const sessions = await prisma.sesiAbsensi.findMany({
    where: whereClause,
    include: {
      jadwal: {
        select: {
          mapel: true,
          kelas: { select: { nama: true } },
        },
      },
      ratings: {
        select: {
          id: true,
          rating: true,
          tags: true,
          komentar: true,
          createdAt: true,
          siswa: { select: { id: true, nama: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: { tanggal: 'desc' },
  })

  // Map to the shape needed by the front‑end
  const result = sessions.map((s) => {
    const ratings = s.ratings
    const count = ratings.length
    const total = ratings.reduce((sum, r) => sum + r.rating, 0)
    const average = count ? Number((total / count).toFixed(1)) : 0
    return {
      id: s.id,
      tanggal: s.tanggal ? s.tanggal.toISOString().split('T')[0] : '',
      mapel: s.jadwal.mapel,
      kelas: s.jadwal.kelas?.nama ?? '',
      average,
      count,
      ratings,
    }
  })

  return result
})

