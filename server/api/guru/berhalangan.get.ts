
export default defineEventHandler(async (event) => {
  const user = (await getUserSession(event)).user
  if (!user || user.role !== 'GURU') {
    throw createError({ statusCode: 403, statusMessage: 'Unauthorized' })
  }

  const query = getQuery(event)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const list = await prisma.guruKetidakhadiran.findMany({
    where: {
      guruId: user.id,
      status: 'AKTIF',
      tanggal: {
        gte: today
      }
    },
    include: {
      sesi: {
        include: {
          jadwal: {
            select: {
              id: true,
              mapel: true,
              jamMulai: true,
              jamSelesai: true,
              kelas: { select: { nama: true } }
            }
          }
        }
      }
    },
    orderBy: { tanggal: 'asc' }
  })

  return { list }
})
