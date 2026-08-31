
export default defineEventHandler(async (event) => {
  const user = (await getUserSession(event)).user
  if (!user || user.role !== 'GURU') {
    throw createError({ statusCode: 403, statusMessage: 'Unauthorized' })
  }

  const id = parseInt(event.context.params!.id)
  const record = await prisma.guruKetidakhadiran.findUnique({
    where: { id },
    include: { sesi: true }
  })

  if (!record || record.guruId !== user.id) {
    throw createError({ statusCode: 404, statusMessage: 'Data ketidakhadiran tidak ditemukan' })
  }

  // Update sesi terkait: reset isGuruBerhalangan
  const sesiIds = record.sesi.map(s => s.id)
  if (sesiIds.length > 0) {
    await prisma.sesiAbsensi.updateMany({
      where: { id: { in: sesiIds } },
      data: {
        isGuruBerhalangan: false,
        guruBerhalanganId: null
      }
    })
  }

  // Update status ketidakhadiran menjadi DIBATALKAN
  await prisma.guruKetidakhadiran.update({
    where: { id },
    data: { status: 'DIBATALKAN' }
  })

  return { success: true, message: 'Pengajuan tidak masuk berhasil dibatalkan' }
})
