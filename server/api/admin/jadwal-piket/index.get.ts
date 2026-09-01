export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const showInactive = query.showInactive === 'true'
  const search = query.search as string | undefined
  const hari = query.hari as string | undefined
  const availableOnly = query.available === 'true'

  // If available=true, return PTK yang bisa ditugaskan (tidak mengajar, bukan wali, bukan pendamping)
  if (availableOnly) {
    const whereClause: any = {
      role: 'GURU',
      isActive: true
    }

    if (search) {
      whereClause.nama = { contains: search }
    }

    // Ambil semua PTK GURU yang aktif
    const allGuru = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        nama: true,
        email: true,
        nip: true,
        foto: true,
        _count: {
          select: {
            jadwalPelajaran: true,
            kelasWali: true,
            jadwalPiket: true
          }
        }
      },
      orderBy: { nama: 'asc' }
    })

    // Filter: tidak mengajar + bukan wali + belum ditugaskan jadwal piket
    const available = allGuru.filter(g =>
      g._count.jadwalPelajaran === 0 &&
      g._count.kelasWali === 0 &&
      g._count.jadwalPiket === 0
    )

    return available.map(({ _count, ...rest }) => rest)
  }

  // Default: list jadwal piket
  const whereClause: any = {
    ...(showInactive ? { isActive: false } : { isActive: true }),
    ...(hari && { hari })
  }

  if (search) {
    whereClause.petugasPiket = {
      nama: { contains: search }
    }
  }

  const data = await prisma.jadwalPiket.findMany({
    where: whereClause,
    include: {
      petugasPiket: {
        select: {
          id: true,
          nama: true,
          email: true,
          nip: true,
          foto: true,
          isActive: true
        }
      }
    },
    orderBy: [
      { hari: 'asc' },
      { jamMulai: 'asc' }
    ]
  })

  return data
})
