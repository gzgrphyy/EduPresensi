export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const siswa = await prisma.siswa.findUnique({
    where: { userId: session.user.id },
    select: { id: true, kelasId: true }
  })
  if (!siswa) {
    throw createError({ statusCode: 404, statusMessage: 'Data murid tidak ditemukan' })
  }

  const now = new Date()
  const today = todayDate()
  const hari = hariIni(now) as any
  const tNow = timeToMinutes(currentTimeHHMM(now))

  const jadwals = await prisma.jadwalPelajaran.findMany({
    where: { kelasId: siswa.kelasId, hari },
    orderBy: { jamMulai: 'asc' },
    include: {
      guru: { select: { id: true, nama: true } },
      ruangan: { select: { nama: true } }
    }
  })

  const berjalan = jadwals.find(j => {
    return tNow >= timeToMinutes(j.jamMulai) - TOLERANSI_MENIT && tNow <= timeToMinutes(j.jamSelesai)
  }) || null

  const bisaBelumSelesai = !!berjalan
  const bisaSudahBeres = !!berjalan

  let sudahBelumSelesai = false
  let sudahSudahBeres = false

  if (bisaBelumSelesai || bisaSudahBeres) {
    const kabarHariIni = await prisma.kabarSesi.findMany({
      where: {
        siswaId: siswa.id,
        tanggal: today,
        jadwalId: berjalan!.id
      },
      select: { jadwalId: true, jenis: true }
    })
    sudahBelumSelesai = kabarHariIni.some(k => k.jenis === 'BELUM_SELESAI')
    sudahSudahBeres = kabarHariIni.some(k => k.jenis === 'SUDAH_BERES')
  }

  return {
    belumSelesai: {
      bisa: bisaBelumSelesai,
      sudah: sudahBelumSelesai,
      mapelBerjalan: berjalan ? {
        mapel: berjalan.mapel,
        guru: berjalan.guru.nama,
        jamMulai: berjalan.jamMulai,
        jamSelesai: berjalan.jamSelesai,
        ruangan: berjalan.ruangan.nama
      } : null,
      target: bisaBelumSelesai ? {
        jadwalId: berjalan!.id,
        mapel: berjalan!.mapel,
        guru: berjalan!.guru.nama,
        jamMulai: berjalan!.jamMulai,
        ruangan: berjalan!.ruangan.nama
      } : null
    },
    sudahBeres: {
      bisa: bisaSudahBeres,
      sudah: sudahSudahBeres,
      target: bisaSudahBeres ? {
        jadwalId: berjalan!.id,
        mapel: berjalan!.mapel,
        guru: berjalan!.guru.nama,
        jamMulai: berjalan!.jamMulai,
        ruangan: berjalan!.ruangan.nama
      } : null
    }
  }
})
