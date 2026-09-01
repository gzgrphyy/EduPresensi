export default defineEventHandler(async (event) => {
  const id = parseInt(getRouterParam(event, 'id')!)
  if (isNaN(id)) throw createError({ statusCode: 400, statusMessage: 'ID tidak valid' })

  const existing = await prisma.user.findFirst({
    where: { id, role: { in: ['GURU', 'PETUGAS_PIKET'] } }
  })
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Guru tidak ditemukan' })

  const rawPassword = generatePassword(10)
  const passwordHash = hashPassword(rawPassword)

  await prisma.user.update({
    where: { id },
    data: { passwordHash }
  })

  return {
    generatedPassword: rawPassword,
    message: 'Password berhasil di-reset. Salin password di bawah dan sampaikan ke guru bersangkutan.'
  }
})
