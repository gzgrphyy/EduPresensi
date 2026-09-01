export default defineEventHandler(async (event) => {
  const id = parseInt(getRouterParam(event, 'id')!)
  if (isNaN(id)) throw createError({ statusCode: 400, statusMessage: 'ID tidak valid' })

  const existing = await prisma.jadwalPiket.findUnique({
    where: { id }
  })
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Jadwal piket tidak ditemukan' })

  await prisma.jadwalPiket.delete({
    where: { id }
  })

  // Cek sisa jadwal piket aktif user, revert ke GURU jika 0
  const sisaJadwal = await prisma.jadwalPiket.count({
    where: { petugasPiketId: existing.petugasPiketId, isActive: true }
  })
  if (sisaJadwal === 0) {
    await prisma.user.update({
      where: { id: existing.petugasPiketId },
      data: { role: 'GURU' }
    })
  }

  return { message: 'Jadwal piket berhasil dihapus' }
})
