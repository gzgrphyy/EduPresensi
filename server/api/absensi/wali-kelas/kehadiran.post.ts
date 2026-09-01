import { z } from 'zod'
import { todayDate } from '~~/server/utils/sesi'

const statusEnum = z.enum(['HADIR', 'SAKIT', 'IZIN', 'ALPHA'])

const bodySchema = z.object({
  kelasId: z.number().int().positive(),
  // multiple dates (YYYY-MM-DD) allowed
  tanggal: z.array(z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/, 'Format tanggal harus YYYY-MM-DD')).min(1),
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

  // Validasi tanggal <= hari ini (optional: allow future dates)
  const today = todayDate()
  // enforce each tanggal in array – currently we allow any date (including future)
  for (const t of tanggal) {
    const tanggalDate = new Date(t + 'T00:00:00Z')
    // Commented out future‑date restriction; remove if you want to forbid future dates
    // if (tanggalDate.getTime() > today.getTime()) {
    //   throw createError({ statusCode: 400, statusMessage: `Tidak dapat mengatur kehadiran untuk tanggal ${t} yang akan datang` })
    // }
  }
  // keep original single‑date variable for later loops (will be overwritten per iteration)


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
  // Karena sekarang tanggal dapat berupa array, kita loop tiap tanggal
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
  const isToday = tanggal.some(t => new Date(t + 'T00:00:00Z').getTime() === todayDate().getTime())
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
    // Loop each selected date
    for (const t of tanggal) {
      const tanggalDate = new Date(t + 'T00:00:00Z')
      const sesiList: { id: number }[] = []
      for (const j of jadwalIds) {
        const sesi = await tx.sesiAbsensi.upsert({
          where: { jadwalId_tanggal: { jadwalId: j, tanggal: tanggalDate } },
          create: { jadwalId: j, tanggal: tanggalDate, status: 'AKTIF' },
          update: {}
        })
        sesiList.push({ id: sesi.id })
      }
      sesiCount += sesiList.length

      // Upsert requests for each siswa & each sesi on this date
      for (const sesi of sesiList) {
        for (const e of entries) {
          const keteranganFinal = (e.keterangan?.trim() || catatanTrim) || null
          const finalStatus = (new Date(t + 'T00:00:00Z').getTime() === todayDate().getTime() && sickStudentIds.has(e.siswaId))
            ? 'SAKIT'
            : e.status
          await tx.absensiRequest.upsert({
            where: { sesiId_siswaId: { sesiId: sesi.id, siswaId: e.siswaId } },
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
