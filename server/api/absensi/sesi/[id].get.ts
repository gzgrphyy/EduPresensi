export default defineEventHandler(async (event) => {
  const user = (await getUserSession(event)).user!
  const id = parseInt(event.context.params!.id)

  const sesi = await prisma.sesiAbsensi.findUnique({
    where: { id },
    include: {
      jadwal: {
        include: {
          kelas: {
            include: {
              siswa: {
                orderBy: { nama: 'asc' },
                select: { id: true, nisn: true, nama: true }
              }
            }
          },
          ruangan: { select: { id: true, nama: true } },
          guru: { select: { id: true, nama: true } }
        }
      },
      requests: {
        include: {
          siswa: { select: { id: true, nama: true, nisn: true } },
          approver: { select: { id: true, nama: true, role: true } }
        },
        orderBy: { scannedAt: 'asc' }
      }
    }
  })

  if (!sesi) {
    throw createError({ statusCode: 404, statusMessage: 'Sesi tidak ditemukan' })
  }
  if (sesi.jadwal.guruId !== user.id && user.role !== 'ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Akses ditolak' })
  }

  const requestMap = new Map(sesi.requests.map(r => [r.siswaId, r]))

  const allSiswa = sesi.jadwal.kelas.siswa.map(s => ({
    id: s.id,
    nisn: s.nisn,
    nama: s.nama,
    request: requestMap.get(s.id) || null
  }))

  return {
    ...sesi,
    allSiswa
  }
})
