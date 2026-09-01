import { updateJadwalPiketSchema } from './schema'

export default defineEventHandler(async (event) => {
  const id = parseInt(getRouterParam(event, 'id')!)
  if (isNaN(id)) throw createError({ statusCode: 400, statusMessage: 'ID tidak valid' })

  const body = await readBody(event)
  const result = updateJadwalPiketSchema.safeParse(body)
  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: result.error.issues[0].message
    })
  }

  const existing = await prisma.jadwalPiket.findUnique({
    where: { id }
  })
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Jadwal piket tidak ditemukan' })

  const { petugasPiketId, hari, jamMulai, jamSelesai, isActive } = result.data

  // Verify PTK if changing
  if (petugasPiketId) {
    const ptk = await prisma.user.findFirst({
      where: { id: petugasPiketId, role: 'GURU' }
    })
    if (!ptk) {
      throw createError({ statusCode: 404, statusMessage: 'PTK tidak ditemukan' })
    }
    if (!ptk.isActive) {
      throw createError({ statusCode: 400, statusMessage: 'PTK tidak aktif' })
    }

    // Cek apakah PTK sedang mengajar
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

  }

  const targetHari = hari || existing.hari
  const targetJamMulai = jamMulai || existing.jamMulai
  const targetJamSelesai = jamSelesai || existing.jamSelesai
  const targetPetugasId = petugasPiketId || existing.petugasPiketId

  // Check for overlapping schedule (excluding current)
  const overlapping = await prisma.jadwalPiket.findFirst({
    where: {
      id: { not: id },
      petugasPiketId: targetPetugasId,
      hari: targetHari,
      isActive: true,
      OR: [
        { jamMulai: { lte: targetJamMulai }, jamSelesai: { gt: targetJamMulai } },
        { jamMulai: { lt: targetJamSelesai }, jamSelesai: { gte: targetJamSelesai } },
        { jamMulai: { gte: targetJamMulai }, jamSelesai: { lte: targetJamSelesai } }
      ]
    }
  })

  if (overlapping) {
    throw createError({
      statusCode: 409,
      statusMessage: `Jadwal bentrok dengan jadwal yang sudah ada (${overlapping.jamMulai} - ${overlapping.jamSelesai})`
    })
  }

  const updated = await prisma.jadwalPiket.update({
    where: { id },
    data: {
      ...(petugasPiketId !== undefined && { petugasPiketId }),
      ...(hari !== undefined && { hari }),
      ...(jamMulai !== undefined && { jamMulai }),
      ...(jamSelesai !== undefined && { jamSelesai }),
      ...(isActive !== undefined && { isActive })
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

  return updated
})
