import { z } from 'zod'

const entrySchema = z.object({
  siswaId: z.number().int().positive(),
  status: z.enum(['HADIR', 'SAKIT', 'IZIN', 'ALPHA']),
  keterangan: z.string().max(255).optional().nullable()
})

const bodySchema = z.object({
  alasanRevisi: z.string().min(3, 'Alasan revisi wajib diisi (minimal 3 karakter)').max(255),
  entries: z.array(entrySchema).min(1, 'Minimal satu entry revisi')
})

export default defineEventHandler(async (event) => {
  const user = (await getUserSession(event)).user
  if (!user || user.role !== 'GURU') {
    throw createError({ statusCode: 403, statusMessage: 'Unauthorized' })
  }

  const sesiId = parseInt(event.context.params!.id)
  const result = bodySchema.safeParse(await readBody(event))
  if (!result.success) {
    throw createError({ statusCode: 400, statusMessage: result.error.issues[0].message })
  }

  const { alasanRevisi, entries } = result.data

  const sesi = await prisma.sesiAbsensi.findUnique({
    where: { id: sesiId },
    include: {
      jadwal: { select: { guruId: true, ptkPendampingId: true } },
      requests: true
    }
  })

  if (!sesi) {
    throw createError({ statusCode: 404, statusMessage: 'Sesi tidak ditemukan' })
  }

  // Hanya guru pengampu asli yang dapat merevisi
  if (sesi.jadwal.guruId !== user.id) {
    throw createError({ statusCode: 403, statusMessage: 'Hanya guru pengampu asli yang dapat merevisi kehadiran sesi ini' })
  }

  const now = new Date()
  const existingReqMap = new Map(sesi.requests.map(r => [r.siswaId, r]))

  await prisma.$transaction(async (tx) => {
    // 1. Update status revisi pada sesi
    await tx.sesiAbsensi.update({
      where: { id: sesiId },
      data: {
        isRevised: true,
        revisiAt: now,
        revisiBy: user.id,
        alasanRevisi
      }
    })

    // 2. Update status per murid & catat detail revisi
    for (const entry of entries) {
      const existing = existingReqMap.get(entry.siswaId)
      const oldStatus = existing ? existing.status : 'BELUM_ABSEN'

      if (existing) {
        await tx.absensiRequest.update({
          where: { id: existing.id },
          data: {
            status: entry.status,
            keterangan: entry.keterangan || existing.keterangan,
            approvedByRole: 'GURU',
            approvedAt: now
          }
        })
      } else {
        await tx.absensiRequest.create({
          data: {
            sesiId,
            siswaId: entry.siswaId,
            status: entry.status,
            keterangan: entry.keterangan || null,
            scannedAt: now,
            approvedByRole: 'GURU',
            approvedAt: now
          }
        })
      }

      // Catat audit trail per perubahan atau ringkasan
      await tx.attendanceAudit.create({
        data: {
          sesiId,
          action: 'REVISED',
          performedBy: user.id,
          role: 'GURU',
          detail: `Siswa ID ${entry.siswaId} diubah dari [${oldStatus}] jadi [${entry.status}] oleh Guru ${user.nama}, alasan: ${alasanRevisi}`
        }
      })
    }
  })

  return {
    success: true,
    message: 'Revisi kehadiran berhasil disimpan'
  }
})
