import { z } from 'zod'
import { todayDate } from '~~/server/utils/sesi'

const statusEnum = z.enum(['HADIR', 'SAKIT', 'IZIN', 'ALPHA'])

const bodySchema = z.object({
  kelasId: z.number().int().positive(),
  tanggal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
  catatanGlobal: z.string().max(255).optional().nullable(),
  entries: z.array(z.object({
    siswaId: z.number().int().positive(),
    status: statusEnum,
    keterangan: z.string().max(255).optional().nullable()
  })).min(1, 'Pilih minimal satu murid')
})

export default defineEventHandler(async (event) => {
  const user = (await getUserSession(event)).user!
  if (user.role !== 'GURU') {
    throw createError({ statusCode: 403, statusMessage: 'Akses ditolak' })
  }

  const result = bodySchema.safeParse(await readBody(event))
  if (!result.success) {
    throw createError({ statusCode: 400, statusMessage: result.error.issues[0].message })
  }

  const { kelasId, tanggal, entries, catatanGlobal } = result.data

  // Validasi tanggal <= hari ini
  const tanggalDate = new Date(tanggal)
  const today = todayDate()
  if (tanggalDate.getTime() > today.getTime()) {
    throw createError({ statusCode: 400, statusMessage: 'Tidak dapat mengatur kehadiran untuk tanggal yang akan datang' })
  }

  // Validasi wali kelas
  const kelas = await prisma.kelas.findFirst({
    where: { id: kelasId, waliKelasId: user.id },
    select: { id: true, siswa: { select: { id: true } } }
  })
  if (!kelas) {
    throw createError({ statusCode: 403, statusMessage: 'Anda bukan wali kelas untuk kelas ini' })
  }

  const siswaIdsInKelas = new Set(kelas.siswa.map(s => s.id))
  const invalidSiswa = entries.find(e => !siswaIdsInKelas.has(e.siswaId))
  if (invalidSiswa) {
    throw createError({ statusCode: 400, statusMessage: `Murid ${invalidSiswa.siswaId} bukan anggota kelas ini` })
  }

  // Ambil atau buat sesi di tanggal tsb untuk kelas tsb (dalam transaksi)
  const jadwalList = await prisma.jadwalPelajaran.findMany({
    where: { kelasId },
    select: { id: true }
  })
  const jadwalIds = jadwalList.map(j => j.id)

  if (jadwalIds.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Kelas ini belum memiliki jadwal pelajaran' })
  }

  const now = new Date()
  const catatanTrim = catatanGlobal?.trim() || null

  // ---------------------------------------------------
  // 1. Detect today & collect student IDs that are marked SA... today
  // ---------------------------------------------------
  const isToday = tanggalDate.getTime() === todayDate().getTime()
  const sickStudentIds = new Set<number>()
  if (isToday) {
    for (const e of entries) {
      if (e.status === 'SAKIT') {
        sickStudentIds.add(e.siswaId)
      }
    }
  }

  // Transaksi: upsert sesi per jadwal + upsert absensiRequest per (sesiId, siswaId)
  // Pakai upsert sesi agar aman dari race condition dengan guru pengampu yang
  // sedang membuka sesi untuk jadwal & tanggal yang sama secara paralel.
  let totalUpserts = 0
  let sesiCount = 0
  await prisma.$transaction(async (tx) => {
    const sesiList: { id: number }[] = []
    for (const j of jadwalIds) {
      const sesi = await tx.sesiAbsensi.upsert({
        where: { jadwalId_tanggal: { jadwalId: j, tanggal: tanggalDate } },
        create: { jadwalId: j, tanggal: tanggalDate, status: 'AKTIF' },
        update: {}
      })
      sesiList.push({ id: sesi.id })
    }
    sesiCount = sesiList.length

    for (const sesi of sesiList) {
      for (const e of entries) {
        const keteranganFinal = (e.keterangan?.trim() || catatanTrim) || null
        // If the student is sick today, force status to SA... regardless of other entries
        const finalStatus = (isToday && sickStudentIds.has(e.siswaId)) ? 'SAKIT' : e.status
        await tx.absensiRequest.upsert({
          where: {
            sesiId_siswaId: { sesiId: sesi.id, siswaId: e.siswaId }
          },
          create: {
            sesiId: sesi.id,
            siswaId: e.siswaId,
            scannedAt: now,
            status: finalStatus,
            keterangan: keteranganFinal,
            approvedBy: user.id,
            approvedAt: now
          },
          update: {
            status: finalStatus,
            keterangan: keteranganFinal,
            approvedBy: user.id,
            approvedAt: now
          }
        })
        totalUpserts++
      }
    }
  })
  return {
    success: true,
    tanggal,
    kelasId,
    sesiCount,
    entriesCount: entries.length,
    totalUpserts
  }
})
