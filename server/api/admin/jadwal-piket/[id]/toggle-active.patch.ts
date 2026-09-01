export default defineEventHandler(async (event) => {
  const id = parseInt(getRouterParam(event, 'id')!)
  if (isNaN(id)) throw createError({ statusCode: 400, statusMessage: 'ID tidak valid' })

  const existing = await prisma.jadwalPiket.findUnique({
    where: { id }
  })
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Jadwal piket tidak ditemukan' })

  const newIsActive = !existing.isActive
  const updated = await prisma.jadwalPiket.update({
    where: { id },
    data: { isActive: newIsActive },
    include: {
      petugasPiket: {
        select: {
          id: true,
          nama: true,
          email: true,
          nip: true,
          foto: true
        }
      }
    }
  })

  // Jika dinonaktifkan, cek sisa jadwal piket aktif. Jika 0, revert ke GURU
  if (!newIsActive) {
    const sisaAktif = await prisma.jadwalPiket.count({
      where: { petugasPiketId: existing.petugasPiketId, isActive: true }
    })
    if (sisaAktif === 0) {
      await prisma.user.update({
        where: { id: existing.petugasPiketId },
        data: { role: 'GURU' }
      })
    }
  }

  return {
    ...updated,
    message: updated.isActive
      ? 'Jadwal piket berhasil diaktifkan'
      : 'Jadwal piket berhasil dinonaktifkan'
  }
})
