import { z } from 'zod'

const querySchema = z.object({
  bulan: z.string().optional(),
  semesterId: z.coerce.number().int().positive().optional(),
  kelasId: z.coerce.number().int().positive().optional()
})

export default defineEventHandler(async (event) => {
  const query = querySchema.parse(getQuery(event))

  const filterTanggal = query.bulan
    ? (() => {
        const [year, month] = query.bulan!.split('-').map(Number)
        return {
          gte: new Date(Date.UTC(year, month - 1, 1)),
          lte: new Date(Date.UTC(year, month, 0, 23, 59, 59, 999))
        }
      })()
    : undefined

  const jadwalFilter: Record<string, unknown> = {}
  if (query.kelasId) {
    jadwalFilter.kelasId = query.kelasId
  }
  if (query.semesterId) {
    jadwalFilter.kelas = {
      semesterId: query.semesterId
    }
  }

  const sesi = await prisma.sesiAbsensi.findMany({
    where: {
      ...(filterTanggal && { tanggal: filterTanggal }),
      ...(Object.keys(jadwalFilter).length > 0 && { jadwal: jadwalFilter })
    },
    include: {
      jadwal: {
        include: {
          kelas: {
            include: {
              _count: { select: { siswa: true } }
            }
          },
          ruangan: { select: { nama: true } }
        }
      },
      requests: {
        select: { status: true }
      }
    }
  })

  const kelasMap = new Map<number, {
    kelasId: number
    kelas: string
    totalSiswa: number
    hadir: number
    sakit: number
    izin: number
    alpha: number
    pending: number
    totalSesi: number
  }>()

  for (const s of sesi) {
    const key = s.jadwal.kelas.id
    if (!kelasMap.has(key)) {
      kelasMap.set(key, {
        kelasId: key,
        kelas: s.jadwal.kelas.nama,
        totalSiswa: s.jadwal.kelas._count.siswa,
        hadir: 0,
        sakit: 0,
        izin: 0,
        alpha: 0,
        pending: 0,
        totalSesi: 0
      })
    }
    const entry = kelasMap.get(key)!
    entry.totalSesi++
    entry.hadir += s.requests.filter(r => r.status === 'HADIR').length
    entry.sakit += s.requests.filter(r => r.status === 'SAKIT').length
    entry.izin += s.requests.filter(r => r.status === 'IZIN').length
    entry.alpha += s.requests.filter(r => r.status === 'ALPHA').length
    entry.pending += s.requests.filter(r => r.status === 'PENDING').length
  }

  const result = Array.from(kelasMap.values()).map(k => {
    const totalExpected = k.totalSiswa * k.totalSesi
    const persentase = totalExpected > 0
      ? Number(((k.hadir / totalExpected) * 100).toFixed(1))
      : 0

    return {
      kelasId: k.kelasId,
      kelas: k.kelas,
      totalSiswa: k.totalSiswa,
      totalSesi: k.totalSesi,
      hadir: k.hadir,
      sakit: k.sakit,
      izin: k.izin,
      alpha: k.alpha,
      pending: k.pending,
      persentase
    }
  })

  return result
})