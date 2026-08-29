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
          kelas: {
            select: {
              nama: true,
              siswa: {
                select: { id: true, nama: true, nisn: true },
                orderBy: { nama: 'asc' },
              },
            },
          },
        },
      },
      ratings: {
        select: {
          id: true,
          rating: true,
          tags: true,
          komentar: true,
          createdAt: true,
          siswaId: true,
          siswa: { select: { id: true, nama: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
      requests: {
        select: {
          siswaId: true,
          status: true,
        },
      },
    },
    orderBy: { tanggal: 'desc' },
  })

  // Map to the shape needed by the front‑end
  const result = sessions.map((s) => {
    const ratings = s.ratings
    const count = ratings.length
    const total = ratings.reduce((sum, r) => sum + r.rating, 0)
    const average: number | null = count ? Number((total / count).toFixed(1)) : null

    // Star distribution (5 down to 1)
    const distribution: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
    ratings.forEach((r) => {
      if (distribution[r.rating] !== undefined) {
        distribution[r.rating]++
      }
    })

    // Map students of the class with their attendance status and rating status
    const attendanceMap = new Map(s.requests.map((req) => [req.siswaId, req.status]))
    const ratingMap = new Map(ratings.map((rt) => [rt.siswaId, rt]))

    const allStudents = s.jadwal.kelas.siswa.map((stu) => {
      const attendanceStatus = attendanceMap.get(stu.id) || 'BELUM'
      const userRating = ratingMap.get(stu.id) || null
      return {
        id: stu.id,
        nama: stu.nama,
        nisn: stu.nisn,
        attendanceStatus,
        rating: userRating ? userRating.rating : null,
        tags: userRating ? userRating.tags : null,
        komentar: userRating ? userRating.komentar : null,
      }
    })

    const totalHadir = allStudents.filter(stu => stu.attendanceStatus === 'HADIR').length

    return {
      id: s.id,
      tanggal: s.tanggal ? s.tanggal.toISOString().split('T')[0] : '',
      mapel: s.jadwal.mapel,
      kelas: s.jadwal.kelas?.nama ?? '',
      totalSiswa: allStudents.length,
      totalHadir,
      average,
      count,
      distribution,
      students: allStudents,
      ratings,
    }
  })

  return result
})

