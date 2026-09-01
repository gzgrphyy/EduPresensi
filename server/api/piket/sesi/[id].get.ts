export default defineEventHandler(async (event) => {
  const user = (await getUserSession(event)).user
  if (!user || (user.role !== 'ADMIN' && user.role !== 'GURU' && user.role !== 'PETUGAS_PIKET')) {
    throw createError({ statusCode: 403, statusMessage: 'Akses ditolak' })
  }

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
          siswa: { select: { id: true, nama: true, nisn: true } }
        },
        orderBy: { scannedAt: 'asc' }
      },
      guruBerhalangan: {
        include: {
          guru: { select: { id: true, nama: true } }
        }
      }
    }
  })

  if (!sesi) {
    throw createError({ statusCode: 404, statusMessage: 'Sesi tidak ditemukan' })
  }

  const requestMap = new Map(sesi.requests.map(r => [r.siswaId, r]))

  const allSiswa = sesi.jadwal.kelas.siswa.map(s => ({
    id: s.id,
    nisn: s.nisn,
    nama: s.nama,
    request: requestMap.get(s.id) || null
  }))

  return {
    id: sesi.id,
    status: sesi.status,
    tanggal: sesi.tanggal.toISOString().split('T')[0],
    ditutupPada: sesi.ditutupPada?.toISOString() || null,
    approvedByRole: sesi.approvedByRole,
    petugasPiketNama: sesi.petugasPiketNama,
    jadwal: {
      mapel: sesi.jadwal.mapel,
      jamMulai: sesi.jadwal.jamMulai,
      jamSelesai: sesi.jadwal.jamSelesai,
      kelas: sesi.jadwal.kelas,
      ruangan: sesi.jadwal.ruangan,
      guru: sesi.jadwal.guru
    },
    guruBerhalangan: sesi.guruBerhalangan,
    allSiswa
  }
})
