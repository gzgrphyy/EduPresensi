export default defineEventHandler(async (event) => {
  const user = (await getUserSession(event)).user!
  if (user.role !== 'GURU') {
    throw createError({ statusCode: 403, statusMessage: 'Akses ditolak' })
  }

  const query = getQuery(event)
  const kelasId = parseInt(query.kelasId as string)
  const tanggalStr = query.tanggal as string
  if (!kelasId || !tanggalStr || !/^\d{4}-\d{2}-\d{2}$/.test(tanggalStr)) {
    throw createError({ statusCode: 400, statusMessage: 'Parameter tidak valid' })
  }

  const kelas = await prisma.kelas.findFirst({
    where: { id: kelasId, waliKelasId: user.id },
    select: { id: true }
  })
  if (!kelas) {
    throw createError({ statusCode: 403, statusMessage: 'Anda bukan wali kelas untuk kelas ini' })
  }

  const tanggalDate = new Date(tanggalStr + 'T00:00:00')
  const count = await prisma.sesiAbsensi.count({
    where: { tanggal: tanggalDate, jadwal: { kelasId } }
  })

  return { count }
})
