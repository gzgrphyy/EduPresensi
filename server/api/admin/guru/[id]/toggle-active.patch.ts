export default defineEventHandler(async (event) => {
  const id = parseInt(getRouterParam(event, 'id')!)
  if (isNaN(id)) throw createError({ statusCode: 400, statusMessage: 'ID tidak valid' })

  const existing = await prisma.user.findFirst({
    where: { id, role: { in: ['GURU', 'PETUGAS_PIKET'] } }
  })
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Guru tidak ditemukan' })

  const updated = await prisma.user.update({
    where: { id },
    data: { isActive: !existing.isActive },
    select: {
      id: true,
      nama: true,
      email: true,
      nip: true,
      isActive: true,
      updatedAt: true
    }
  })

  return {
    ...updated,
    message: updated.isActive
      ? 'Akun guru berhasil diaktifkan'
      : 'Akun guru berhasil dinonaktifkan'
  }
})
