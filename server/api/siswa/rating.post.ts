export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const siswa = await prisma.siswa.findUnique({ where: { userId: session.user.id } })
  if (!siswa) {
    throw createError({ statusCode: 404, statusMessage: 'Data murid tidak ditemukan' })
  }

  const body = await readBody(event)
  const { sesiId, rating, tags, komentar } = body

  if (!sesiId || !rating || rating < 1 || rating > 5) {
    throw createError({ statusCode: 400, statusMessage: 'Parameter rating tidak valid' })
  }

  // Pastikan sesi ada dan siswa hadir/tercatat di sesi tersebut
  const absensi = await prisma.absensiRequest.findFirst({
    where: {
      sesiId: Number(sesiId),
      siswaId: siswa.id,
      status: 'HADIR'
    }
  })

  if (!absensi) {
    throw createError({ statusCode: 403, statusMessage: 'Anda hanya dapat memberikan rating pada kelas yang dihadiri' })
  }

  const savedRating = await prisma.ratingSesi.upsert({
    where: {
      sesiId_siswaId: {
        sesiId: Number(sesiId),
        siswaId: siswa.id
      }
    },
    update: {
      rating: Number(rating),
      tags: tags || null,
      komentar: komentar || null
    },
    create: {
      sesiId: Number(sesiId),
      siswaId: siswa.id,
      rating: Number(rating),
      tags: tags || null,
      komentar: komentar || null
    }
  })

  return { success: true, data: savedRating }
})
