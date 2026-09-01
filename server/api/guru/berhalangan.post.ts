import { z } from 'zod'
import { getOrCreateSesi } from '~~/server/utils/sesi'

const bodySchema = z.object({
  tanggal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  alasan: z.enum(['SAKIT', 'IZIN', 'DINAS_LUAR', 'LAINNYA']),
  keterangan: z.string().max(255).optional().nullable(),
  excludedJadwalIds: z.array(z.number().int()).optional() // sessions unchecked by teacher
})

export default defineEventHandler(async (event) => {
  const user = (await getUserSession(event)).user
  if (!user || user.role !== 'GURU') {
    throw createError({ statusCode: 403, statusMessage: 'Unauthorized' })
  }

  const result = bodySchema.safeParse(await readBody(event))
  if (!result.success) {
    throw createError({ statusCode: 400, statusMessage: result.error.issues[0].message })
  }

  const { tanggal, alasan, keterangan, excludedJadwalIds = [] } = result.data
  const dateObj = new Date(tanggal + 'T00:00:00Z')

  // Tentukan hari dalam uppercase
  const daysMap = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU']
  const hariEnum = daysMap[dateObj.getDay()] as any

  // 1. Buat record ketidakhadiran guru
  const ketidakhadiran = await prisma.guruKetidakhadiran.create({
    data: {
      guruId: user.id,
      tanggal: dateObj,
      alasan,
      keterangan: keterangan || null,
      status: 'AKTIF'
    }
  })

  // 2. Ambil semua jadwal guru pada hari tersebut
  const jadwals = await prisma.jadwalPelajaran.findMany({
    where: {
      guruId: user.id,
      hari: hariEnum
    }
  })

  const targetJadwals = jadwals.filter(j => !excludedJadwalIds.includes(j.id))

  // 3. Update / buat sesi absensi menjadi isGuruBerhalangan = true
  for (const j of targetJadwals) {
    const sesi = await getOrCreateSesi(j.id, dateObj)
    await prisma.sesiAbsensi.update({
      where: { id: sesi.id },
      data: {
        isGuruBerhalangan: true,
        guruBerhalanganId: ketidakhadiran.id
      }
    })

    // Catat audit trail
    await prisma.attendanceAudit.create({
      data: {
        sesiId: sesi.id,
        action: 'MARKED_UNAVAILABLE',
        performedBy: user.id,
        role: 'GURU',
        detail: `Guru ${user.nama} mengajukan tidak masuk (${alasan}): ${keterangan || '-'}`
      }
    })
  }

  return {
    success: true,
    message: 'Pengajuan tidak masuk berhasil disimpan',
    ketidakhadiran,
    affectedSessions: targetJadwals.length
  }
})
