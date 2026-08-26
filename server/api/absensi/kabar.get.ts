export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  if (session.user.role !== 'GURU') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const now = new Date()
  const today = todayDate()
  const tNow = timeToMinutes(currentTimeHHMM(now))

  const kabars = await prisma.kabarSesi.findMany({
    where: { tanggal: today, jadwal: { guruId: session.user.id } },
    include: {
      siswa: { select: { nama: true } },
      jadwal: {
        select: {
          id: true,
          mapel: true,
          jamMulai: true,
          jamSelesai: true,
          kelas: { select: { nama: true } },
          ruangan: { select: { nama: true } }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  })

  interface KabarGroup {
    jadwalId: number
    jenis: string
    mapel: string
    jamMulai: string
    jamSelesai: string
    kelas: string
    ruangan: string
    jumlahPelapor: number
    pelapor: string[]
    terakhirPada: Date
  }

  const grouped = new Map<string, KabarGroup>()

  for (const k of kabars) {
    const key = `${k.jadwal.id}:${k.jenis}`
    const entry = grouped.get(key)
    if (entry) {
      entry.jumlahPelapor++
      entry.pelapor.push(k.siswa.nama)
      if (k.createdAt > entry.terakhirPada) entry.terakhirPada = k.createdAt
    } else {
      grouped.set(key, {
        jadwalId: k.jadwal.id,
        jenis: k.jenis,
        mapel: k.jadwal.mapel,
        jamMulai: k.jadwal.jamMulai,
        jamSelesai: k.jadwal.jamSelesai,
        kelas: k.jadwal.kelas.nama,
        ruangan: k.jadwal.ruangan.nama,
        jumlahPelapor: 1,
        pelapor: [k.siswa.nama],
        terakhirPada: k.createdAt
      })
    }
  }

  const items = [...grouped.values()].sort((a, b) => a.jamMulai.localeCompare(b.jamMulai))

  const masihRelevan = (i: KabarGroup) => {
    return tNow <= timeToMinutes(i.jamSelesai)
  }

  const belumSelesai = items.filter(i => i.jenis === 'BELUM_SELESAI' && masihRelevan(i))
  const sudahBeres = items.filter(i => i.jenis === 'SUDAH_BERES' && masihRelevan(i))

  return {
    totalKabar: kabars.length,
    belumSelesai,
    sudahBeres,
    items
  }
})
