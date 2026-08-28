export default defineEventHandler(async (event) => {
  const user = (await getUserSession(event)).user!
  await finalizeExpiredSesi()

  const kelasWali = await prisma.kelas.findMany({
    where: { waliKelasId: user.id },
    select: { id: true }
  })
  const kelasIds = kelasWali.map(k => k.id)

  const sesi = await prisma.sesiAbsensi.findMany({
    where: {
      status: 'AKTIF',
      tanggal: todayDate(),
      OR: [
        { jadwal: { guruId: user.id } },
        { jadwal: { kelasId: { in: kelasIds } } }
      ]
    },
    include: {
      jadwal: {
        include: {
          kelas: { select: { id: true, nama: true, waliKelasId: true } },
          ruangan: { select: { id: true, nama: true } },
          guru: { select: { id: true, nama: true } }
        }
      },
      _count: { select: { requests: true } }
    }
  })

  return sesi
})