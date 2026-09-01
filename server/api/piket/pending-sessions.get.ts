
export default defineEventHandler(async (event) => {
  const user = (await getUserSession(event)).user
  const isGuruOrAdmin = user && (user.role === 'ADMIN' || user.role === 'GURU' || user.role === 'PETUGAS_PIKET')
  if (!isGuruOrAdmin) {
    throw createError({ statusCode: 403, statusMessage: 'Akses khusus Guru Piket atau Admin' })
  }

  const query = getQuery(event)
  const tanggal = (query.tanggal as string) || new Date().toISOString().split('T')[0]
  const kelasId = query.kelasId ? parseInt(query.kelasId as string) : undefined
  const mapel = (query.mapel as string) || undefined

  const dateObj = new Date(tanggal + 'T00:00:00Z')

  const whereClause: any = {
    tanggal: dateObj,
    // Hanya sesi di mana guru sudah konfirmasi berhalangan (sakit/izin/dinas/lainnya)
    isGuruBerhalangan: true
  }

  if (kelasId) {
    whereClause.jadwal = { ...whereClause.jadwal, kelasId }
  }
  if (mapel) {
    whereClause.jadwal = { ...whereClause.jadwal, mapel: { contains: mapel } }
  }

  const sessions = await prisma.sesiAbsensi.findMany({
    where: whereClause,
    include: {
      jadwal: {
        include: {
          kelas: { select: { id: true, nama: true } },
          guru: { select: { id: true, nama: true } },
          ptkPendamping: { select: { id: true, nama: true } },
          ruangan: { select: { id: true, nama: true } }
        }
      },
      guruBerhalangan: {
        include: {
          guru: { select: { id: true, nama: true } }
        }
      },
      requests: {
        include: {
          siswa: { select: { id: true, nama: true, nisn: true } }
        }
      }
    },
    orderBy: [
      { isGuruBerhalangan: 'desc' },
      { jadwal: { jamMulai: 'asc' } }
    ]
  })

  return {
    tanggal,
    dikonfirmasiBerhalangan: sessions,
    total: sessions.length
  }
})
