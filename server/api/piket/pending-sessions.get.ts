
export default defineEventHandler(async (event) => {
  const user = (await getUserSession(event)).user
  const isPiketOrAdmin = user && (user.role === 'ADMIN' || user.email?.toLowerCase().includes('piket') || user.nama?.toLowerCase().includes('piket'))
  if (!isPiketOrAdmin) {
    throw createError({ statusCode: 403, statusMessage: 'Akses khusus Akun / Petugas Piket atau Admin' })
  }

  const query = getQuery(event)
  const tanggal = (query.tanggal as string) || new Date().toISOString().split('T')[0]
  const kelasId = query.kelasId ? parseInt(query.kelasId as string) : undefined
  const mapel = (query.mapel as string) || undefined

  const dateObj = new Date(tanggal + 'T00:00:00')

  const whereClause: any = {
    tanggal: dateObj,
    // Sesi yang belum di-approve oleh guru utama (atau berstatus AKTIF / belum final)
    // Atau sesi yang di-set berhalangan
    OR: [
      { isGuruBerhalangan: true },
      { approvedByRole: null }
    ]
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

  // Kategorisasi sesuai plan:
  // 1. "Dikonfirmasi Berhalangan" (Skenario A: isGuruBerhalangan = true)
  // 2. "Menunggu Laporan" (Skenario B: isGuruBerhalangan = false / PENDING biasa)
  const dikonfirmasiBerhalangan = sessions.filter(s => s.isGuruBerhalangan)
  const menungguLaporan = sessions.filter(s => !s.isGuruBerhalangan)

  return {
    tanggal,
    dikonfirmasiBerhalangan,
    menungguLaporan,
    total: sessions.length
  }
})
