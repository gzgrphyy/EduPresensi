export default defineEventHandler(async (event) => {
  const user = (await getUserSession(event)).user!
  if (user.role !== 'GURU') {
    throw createError({ statusCode: 403, statusMessage: 'Akses ditolak' })
  }

  const kelas = await prisma.kelas.findMany({
    where: { waliKelasId: user.id },
    select: {
      id: true,
      nama: true,
      semester: { select: { nama: true, tahunAjaran: { select: { nama: true } } } },
      siswa: {
        orderBy: { nama: 'asc' },
        select: { id: true, nisn: true, nama: true }
      },
      _count: { select: { siswa: true } }
    },
    orderBy: { nama: 'asc' }
  })

  return {
    isWaliKelas: kelas.length > 0,
    kelas
  }
})
