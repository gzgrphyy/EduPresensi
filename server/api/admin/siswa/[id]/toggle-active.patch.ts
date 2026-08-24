export default defineEventHandler(async (event) => {
  const id = parseInt(getRouterParam(event, 'id')!)
  if (isNaN(id)) throw createError({ statusCode: 400, statusMessage: 'ID tidak valid' })

  const existing = await prisma.siswa.findUnique({
    where: { id },
    include: { user: true }
  })
  if (!existing || !existing.user) throw createError({ statusCode: 404, statusMessage: 'Siswa tidak ditemukan' })

  const updatedUser = await prisma.user.update({
    where: { id: existing.userId },
    data: { isActive: !existing.user.isActive },
    select: {
      id: true,
      nama: true,
      email: true,
      isActive: true,
      updatedAt: true
    }
  })

  return {
    ...updatedUser,
    message: updatedUser.isActive
      ? 'Akun siswa berhasil diaktifkan'
      : 'Akun siswa berhasil dinonaktifkan'
  }
})
