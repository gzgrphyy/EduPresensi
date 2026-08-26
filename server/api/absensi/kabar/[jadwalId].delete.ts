import { z } from 'zod'

const querySchema = z.object({
  jenis: z.enum(['BELUM_SELESAI', 'SUDAH_BERES'])
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  if (session.user.role !== 'GURU') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const jadwalId = Number(getRouterParam(event, 'jadwalId'))
  if (!Number.isInteger(jadwalId) || jadwalId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Jadwal tidak valid' })
  }

  const parsed = querySchema.safeParse(getQuery(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Parameter jenis tidak valid' })
  }
  const { jenis } = parsed.data

  const jadwal = await prisma.jadwalPelajaran.findFirst({
    where: { id: jadwalId, guruId: session.user.id },
    select: { id: true }
  })
  if (!jadwal) {
    throw createError({ statusCode: 404, statusMessage: 'Jadwal tidak ditemukan' })
  }

  const deleted = await prisma.kabarSesi.deleteMany({
    where: {
      jadwalId,
      jenis,
      tanggal: todayDate(),
      jadwal: { guruId: session.user.id }
    }
  })

  return { success: true, deleted: deleted.count }
})
