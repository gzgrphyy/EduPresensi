import { z } from 'zod'

const entrySchema = z.object({
  siswaId: z.number().int().positive(),
  status: z.enum(['HADIR', 'SAKIT', 'IZIN', 'ALPHA']),
  keterangan: z.string().max(255).optional().nullable()
})

const bodySchema = z.object({
  sesiId: z.number().int().positive(),
  petugasPiketNama: z.string().min(2, 'Nama Petugas Piket wajib diisi').max(100),
  entries: z.array(entrySchema).optional()
})

export default defineEventHandler(async (event) => {
  const user = (await getUserSession(event)).user
  const isGuruOrAdmin = user && (user.role === 'ADMIN' || user.role === 'GURU' || user.role === 'PETUGAS_PIKET')
  if (!isGuruOrAdmin) {
    throw createError({ statusCode: 403, statusMessage: 'Akses khusus Guru Piket atau Admin' })
  }

  // Cek jadwal piket untuk guru/petugas piket (bukan admin)
  if (user.role === 'GURU' || user.role === 'PETUGAS_PIKET') {
    const now = new Date()
    const dayNames = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU']
    const currentDay = dayNames[now.getDay()]
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

    const jadwal = await prisma.jadwalPiket.findFirst({
      where: {
        petugasPiketId: user.id,
        hari: currentDay,
        isActive: true,
        jamMulai: { lte: currentTime },
        jamSelesai: { gt: currentTime }
      }
    })

    if (!jadwal) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Anda tidak sedang dalam jadwal piket. Hanya guru yang sedang bertugas piket yang dapat melakukan approve.'
      })
    }
  }

  const result = bodySchema.safeParse(await readBody(event))
  if (!result.success) {
    throw createError({ statusCode: 400, statusMessage: result.error.issues[0].message })
  }

  const { sesiId, petugasPiketNama, entries = [] } = result.data

  const sesi = await prisma.sesiAbsensi.findUnique({
    where: { id: sesiId },
    include: {
      jadwal: {
        include: {
          kelas: { include: { siswa: { select: { id: true } } } }
        }
      },
      requests: true
    }
  })

  if (!sesi) {
    throw createError({ statusCode: 404, statusMessage: 'Sesi tidak ditemukan' })
  }

  // Idempotency guard: jika sudah di-approve sebelumnya
  if (sesi.approvedByRole) {
    return {
      success: true,
      message: 'Sesi ini sudah sebelumnya disetujui',
      sesi
    }
  }

  const now = new Date()
  const siswaIds = sesi.jadwal.kelas.siswa.map(s => s.id)
  const siswaIdsSet = new Set(siswaIds)

  await prisma.$transaction(async (tx) => {
    // 1. Update sesi absensi
    await tx.sesiAbsensi.update({
      where: { id: sesiId },
      data: {
        approvedByRole: 'GURU_PIKET',
        petugasPiketNama,
        status: 'SELESAI',
        ditutupPada: now
      }
    })

    // 2. Proses entries jika ada dari modal piket
    if (entries.length > 0) {
      const validEntries = entries.filter(e => siswaIdsSet.has(e.siswaId))
      const existingReqs = new Map(sesi.requests.map(r => [r.siswaId, r.id]))

      for (const entry of validEntries) {
        if (existingReqs.has(entry.siswaId)) {
          await tx.absensiRequest.update({
            where: { id: existingReqs.get(entry.siswaId)! },
            data: {
              status: entry.status,
              keterangan: entry.keterangan || null,
              approvedByRole: 'GURU_PIKET',
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
              approvedByRole: 'GURU_PIKET',
              approvedAt: now
            }
          })
        }
      }
    } else {
      // Default: finalize scanned students as HADIR, missing students as ALPHA
      const requestedIds = new Set(sesi.requests.map(r => r.siswaId))
      const missingIds = siswaIds.filter(id => !requestedIds.has(id))

      // Update PENDING requests to HADIR (sudah scan, belum final)
      const pendingReqIds = sesi.requests.filter(r => r.status === 'PENDING').map(r => r.id)
      if (pendingReqIds.length > 0) {
        await tx.absensiRequest.updateMany({
          where: { id: { in: pendingReqIds } },
          data: {
            status: 'HADIR',
            approvedByRole: 'GURU_PIKET',
            approvedAt: now
          }
        })
      }

      // Create missing students as ALPHA (belum scan sama sekali)
      if (missingIds.length > 0) {
        const toCreate = missingIds.map(siswaId => ({
          sesiId,
          siswaId,
          status: 'ALPHA' as const,
          scannedAt: now,
          approvedByRole: 'GURU_PIKET' as const,
          approvedAt: now
        }))
        await tx.absensiRequest.createMany({ data: toCreate })
      }
    }

    // 3. Catat audit trail
    await tx.attendanceAudit.create({
      data: {
        sesiId,
        action: 'APPROVED',
        performedBy: user.id,
        role: 'GURU_PIKET',
        petugasPiketNama,
        detail: `Disetujui oleh Guru Piket (${petugasPiketNama})`
      }
    })
  })

  return {
    success: true,
    message: 'Sesi berhasil disetujui oleh Guru Piket'
  }
})
