import { createJadwalPiketSchema } from './schema'

export default defineEventHandler(async (event) => {
  const result = createJadwalPiketSchema.safeParse(await readBody(event))
  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: result.error.issues[0].message
    })
  }

  const { petugasPiketId, hari, jamMulai, jamSelesai } = result.data

  // Verify PTK exists and is active
  const ptk = await prisma.user.findFirst({
    where: { id: petugasPiketId, role: { in: ['GURU', 'PETUGAS_PIKET'] } }
  })
  if (!ptk) {
    throw createError({
      statusCode: 404,
      statusMessage: 'PTK tidak ditemukan'
    })
  }

  if (!ptk.isActive) {
    throw createError({
      statusCode: 400,
      statusMessage: 'PTK tidak aktif'
    })
  }

  // Cek apakah PTK sedang mengajar (punya jadwal_pelajaran)
  const mengajarCount = await prisma.jadwalPelajaran.count({
    where: { guruId: petugasPiketId }
  })
  if (mengajarCount > 0) {
    throw createError({
      statusCode: 409,
      statusMessage: 'PTK ini sedang mengajar dan tidak dapat ditugaskan sebagai petugas piket'
    })
  }

  // Cek apakah PTK adalah wali kelas
  const waliKelasCount = await prisma.kelas.count({
    where: { waliKelasId: petugasPiketId }
  })
  if (waliKelasCount > 0) {
    throw createError({
      statusCode: 409,
      statusMessage: 'PTK ini adalah wali kelas dan tidak dapat ditugaskan sebagai petugas piket'
    })
  }

  // Check for overlapping schedule on the same day
  const overlapping = await prisma.jadwalPiket.findFirst({
    where: {
      petugasPiketId,
      hari,
      isActive: true,
      OR: [
        { jamMulai: { lte: jamMulai }, jamSelesai: { gt: jamMulai } },
        { jamMulai: { lt: jamSelesai }, jamSelesai: { gte: jamSelesai } },
        { jamMulai: { gte: jamMulai }, jamSelesai: { lte: jamSelesai } }
      ]
    }
  })

  if (overlapping) {
    throw createError({
      statusCode: 409,
      statusMessage: `Jadwal bentrok dengan jadwal yang sudah ada (${overlapping.jamMulai} - ${overlapping.jamSelesai})`
    })
  }

  const jadwal = await prisma.jadwalPiket.create({
    data: {
      petugasPiketId,
      hari,
      jamMulai,
      jamSelesai,
      isActive: true
    },
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

  // Ubah role PTK menjadi PETUGAS_PIKET
  if (ptk.role === 'GURU') {
    await prisma.user.update({
      where: { id: petugasPiketId },
      data: { role: 'PETUGAS_PIKET' }
    })
  }

  return {
    ...jadwal,
    message: 'Jadwal piket berhasil ditambahkan'
  }
})
