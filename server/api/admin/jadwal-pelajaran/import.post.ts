import { z } from 'zod'

const hariValues = ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU', 'MINGGU'] as const

const importJadwalSchema = z.object({
  items: z.array(z.object({
    hari: z.string().min(1),
    jamMulai: z.string().min(1),
    jamSelesai: z.string().min(1),
    mapel: z.string().max(100).optional().default(''),
    kelas: z.string().min(1),
    ruangan: z.string().min(1),
    guruPengampu: z.string().min(1),
    ptkPendamping: z.string().optional().nullable()
  })).min(1, 'Data tidak boleh kosong')
})

const jamRegex = /^\d{2}:\d{2}$/

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const result = importJadwalSchema.safeParse(body)
  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: result.error.issues[0].message
    })
  }

  const items = result.data.items
  const summary = {
    total: items.length,
    success: 0,
    failed: 0,
    errors: [] as Array<{ row: number; error: string }>
  }

  const [kelasList, ruanganList, guruList, pendampingList, existingJadwal] = await Promise.all([
    prisma.kelas.findMany({ select: { id: true, nama: true } }),
    prisma.ruangan.findMany({ select: { id: true, nama: true } }),
    prisma.user.findMany({ where: { role: 'GURU' }, select: { id: true, nama: true } }),
    prisma.ptkPendamping.findMany({ select: { id: true, nama: true } }),
    prisma.jadwalPelajaran.findMany()
  ])

  const kelasMap = new Map(kelasList.map(k => [k.nama.toLowerCase(), k.id]))
  const ruanganMap = new Map(ruanganList.map(r => [r.nama.toLowerCase(), r.id]))
  const guruMap = new Map(guruList.map(g => [g.nama.toLowerCase(), g.id]))
  const pendampingMap = new Map(pendampingList.map(p => [p.nama.toLowerCase(), p.id]))

  interface PendingJadwal {
    kelasId: number
    ruanganId: number
    guruId: number
    hari: string
    jamMulai: string
    jamSelesai: string
    mapel: string
  }
  const batchJadwal: PendingJadwal[] = []

  for (const item of items) {
    const rowIndex = items.indexOf(item) + 1

    const hariUpper = item.hari.trim().toUpperCase()
    if (!hariValues.includes(hariUpper as any)) {
      summary.failed++
      summary.errors.push({ row: rowIndex, error: `Hari "${item.hari}" tidak valid (gunakan: ${hariValues.join(', ')})` })
      continue
    }

    if (!item.jamMulai.trim() || !item.jamSelesai.trim()) {
      summary.failed++
      summary.errors.push({ row: rowIndex, error: 'Jam mulai dan jam selesai wajib diisi' })
      continue
    }

    const jamMulai = item.jamMulai.trim()
    const jamSelesai = item.jamSelesai.trim()
    if (!jamRegex.test(jamMulai) || !jamRegex.test(jamSelesai)) {
      summary.failed++
      summary.errors.push({ row: rowIndex, error: `Format jam harus HH:MM (diterima: "${jamMulai}" - "${jamSelesai}")` })
      continue
    }
    if (jamMulai >= jamSelesai) {
      summary.failed++
      summary.errors.push({ row: rowIndex, error: 'Jam mulai harus lebih awal dari jam selesai' })
      continue
    }

    if (!item.mapel.trim()) {
      summary.failed++
      summary.errors.push({ row: rowIndex, error: 'Mata pelajaran wajib diisi' })
      continue
    }

    const kelasId = kelasMap.get(item.kelas.trim().toLowerCase())
    if (!kelasId) {
      summary.failed++
      summary.errors.push({ row: rowIndex, error: `Kelas "${item.kelas}" tidak ditemukan` })
      continue
    }

    const ruanganId = ruanganMap.get(item.ruangan.trim().toLowerCase())
    if (!ruanganId) {
      summary.failed++
      summary.errors.push({ row: rowIndex, error: `Ruangan "${item.ruangan}" tidak ditemukan` })
      continue
    }

    const guruId = guruMap.get(item.guruPengampu.trim().toLowerCase())
    if (!guruId) {
      summary.failed++
      summary.errors.push({ row: rowIndex, error: `Guru pengampu "${item.guruPengampu}" tidak ditemukan` })
      continue
    }

    let ptkPendampingId: number | null = null
    if (item.ptkPendamping && item.ptkPendamping.trim()) {
      ptkPendampingId = pendampingMap.get(item.ptkPendamping.trim().toLowerCase()) ?? null
      if (ptkPendampingId === null) {
        summary.failed++
        summary.errors.push({ row: rowIndex, error: `PTK pendamping "${item.ptkPendamping}" tidak ditemukan` })
        continue
      }
    }

    // Deteksi bentrok terhadap DB + baris lain dalam batch yang sama
    const bentrokDb = existingJadwal.filter(j =>
      j.hari === hariUpper &&
      (j.kelasId === kelasId || j.ruanganId === ruanganId || j.guruId === guruId) &&
      jamMulai < j.jamSelesai && jamSelesai > j.jamMulai
    )
    const bentrokBatch = batchJadwal.filter(j =>
      j.hari === hariUpper &&
      (j.kelasId === kelasId || j.ruanganId === ruanganId || j.guruId === guruId) &&
      jamMulai < j.jamSelesai && jamSelesai > j.jamMulai
    )
    const bentrok = [...bentrokDb, ...bentrokBatch]

    if (bentrok.length > 0) {
      const c = bentrok[0]
      const parts: string[] = []
      if ('mapel' in c && c.mapel) parts.push(`"${(c as any).mapel}" ${(c as any).jamMulai}-${(c as any).jamSelesai}`)
      if (c.kelasId === kelasId) parts.push('kelas sudah ada jadwal')
      if (c.ruanganId === ruanganId) parts.push('ruangan sudah dipakai')
      if (c.guruId === guruId) parts.push('guru sudah mengajar')
      summary.failed++
      summary.errors.push({ row: rowIndex, error: `Jadwal bentrok pada ${hariUpper} ${jamMulai}-${jamSelesai}: ${parts.join('; ')}` })
      continue
    }

    try {
      await prisma.jadwalPelajaran.create({
        data: {
          kelasId,
          ruanganId,
          mapel: item.mapel.trim(),
          guruId,
          ptkPendampingId,
          hari: hariUpper as any,
          jamMulai,
          jamSelesai
        }
      })
      batchJadwal.push({ kelasId, ruanganId, guruId, hari: hariUpper, jamMulai, jamSelesai, mapel: item.mapel.trim() })
      summary.success++
    } catch (err: any) {
      summary.failed++
      summary.errors.push({ row: rowIndex, error: err.message || 'Gagal menyimpan jadwal' })
    }
  }

  return {
    summary,
    message: `Import selesai. Berhasil: ${summary.success}, Gagal: ${summary.failed}`
  }
})
