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

  try {
    const kelas = await prisma.kelas.findFirst({
      where: { id: kelasId, waliKelasId: user.id },
      select: { id: true }
    })
    if (!kelas) {
      throw createError({ statusCode: 403, statusMessage: 'Anda bukan wali kelas untuk kelas ini' })
    }

    const tanggalDate = new Date(tanggalStr)

    const jadwalList = await prisma.jadwalPelajaran.findMany({
      where: { kelasId },
      select: { id: true }
    })
    const jadwalIds = jadwalList.map(j => j.id)

    if (jadwalIds.length === 0) {
      return { marked: [] }
    }

    // Auto-create sesi di dalam transaksi agar visible oleh query berikutnya.
    // Pakai upsert per jadwal agar atomic & race-safe terhadap transaksi paralel
    // (mis. guru pengampu yang sedang membuka sesi untuk jadwal yang sama).
    const allSesiIds = await prisma.$transaction(async (tx) => {
      const ids: number[] = []
      for (const j of jadwalIds) {
        const sesi = await tx.sesiAbsensi.upsert({
          where: { jadwalId_tanggal: { jadwalId: j, tanggal: tanggalDate } },
          create: { jadwalId: j, tanggal: tanggalDate, status: 'AKTIF' },
          update: {}
        })
        ids.push(sesi.id)
      }
      return ids
    })

    const requests = await prisma.absensiRequest.findMany({
      where: {
        sesiId: { in: allSesiIds },
        status: { in: ['HADIR', 'SAKIT', 'IZIN', 'ALPHA'] },
        approvedBy: user.id
      },
      select: { siswaId: true, status: true, keterangan: true }
    })

    const map = new Map<number, { status: string; keterangan: string | null }>()
    for (const r of requests) {
      if (!map.has(r.siswaId)) {
        map.set(r.siswaId, { status: r.status, keterangan: r.keterangan })
      }
    }

    return {
      marked: Array.from(map.entries()).map(([siswaId, v]) => ({
        siswaId,
        status: v.status as 'HADIR' | 'SAKIT' | 'IZIN' | 'ALPHA',
        keterangan: v.keterangan || ''
      }))
    }
  } catch (err: any) {
    if (err?.statusCode) throw err
    console.error('[wali-kelas/existing] error:', err)
    throw createError({ statusCode: 500, statusMessage: err?.message || 'Gagal memuat data kehadiran' })
  }
})
