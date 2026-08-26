import { z } from 'zod'

const bodySchema = z.object({
  jadwalId: z.number().int().positive(),
  jenis: z.enum(['BELUM_SELESAI', 'SUDAH_BERES'])
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const siswa = await prisma.siswa.findUnique({
    where: { userId: session.user.id },
    select: { id: true, kelasId: true }
  })
  if (!siswa) {
    throw createError({ statusCode: 404, statusMessage: 'Data murid tidak ditemukan' })
  }

  const body = await readBody(event)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Data tidak valid' })
  }
  const { jadwalId, jenis } = parsed.data

  const now = new Date()
  const today = todayDate()
  const hari = hariIni(now) as any
  const tNow = timeToMinutes(currentTimeHHMM(now))

  const target = await prisma.jadwalPelajaran.findFirst({
    where: { id: jadwalId, kelasId: siswa.kelasId, hari },
    include: { guru: { select: { nama: true } } }
  })
  if (!target) {
    throw createError({ statusCode: 404, statusMessage: 'Jadwal tidak ditemukan' })
  }

  const berjalan = tNow >= timeToMinutes(target.jamMulai) - TOLERANSI_MENIT && tNow <= timeToMinutes(target.jamSelesai)
  if (!berjalan) {
    throw createError({ statusCode: 400, statusMessage: 'Jadwal ini sedang tidak berjalan' })
  }

  const existing = await prisma.kabarSesi.findUnique({
    where: { jadwalId_siswaId_tanggal_jenis: { jadwalId, siswaId: siswa.id, tanggal: today, jenis } }
  })
  if (existing) {
    return { success: true, message: 'Kabar sudah dikirim sebelumnya', sudahKabar: true }
  }

  await prisma.kabarSesi.create({
    data: { jadwalId, siswaId: siswa.id, tanggal: today, jenis }
  })

  return { success: true, message: `Kabar terkirim ke ${target.guru.nama}`, sudahKabar: true }
})
