import { z } from 'zod'
import ExcelJS from 'exceljs'
import { createStyledWorkbook, applyHeaderStyle, applyTitleBlock, autoFitColumns, applyDataRowStyle } from '~~/server/utils/export-excel'

const generateSchema = z.object({
  jenis: z.string(),
  format: z.enum(['xlsx']).default('xlsx'),
  filters: z.object({
    tanggal: z.string().optional(),
    tanggalMulai: z.string().optional(),
    tanggalSelesai: z.string().optional(),
    bulan: z.string().optional(),
    tahun: z.coerce.number().optional(),
    semesterId: z.coerce.number().optional(),
    tahunAjaranId: z.coerce.number().optional(),
    kelasIds: z.array(z.coerce.number()).optional(),
    kelasId: z.coerce.number().optional(),
    sesiId: z.coerce.number().optional(),
    siswaId: z.coerce.number().optional(),
    statusIzin: z.string().optional()
  }).optional().default({})
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  const userId = session.user?.id || 1

  const body = await readBody(event)
  const { jenis, filters } = generateSchema.parse(body)

  let fileName = `${jenis}-${new Date().toISOString().slice(0, 10)}.xlsx`
  let filterSummary = ''
  let fileBuffer: Buffer | null = null
  let reportTitle = ''

  // Helper date parsing
  function parseDate(dStr?: string, endOfDay = false) {
    if (!dStr) return undefined
    const [y, m, d] = dStr.split('-').map(Number)
    return new Date(Date.UTC(y, m - 1, d, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0))
  }

  // ==========================================
  // 1. REKAP HARIAN (XLSX)
  // ==========================================
  if (jenis === 'rekap-harian') {
    reportTitle = 'Rekap Presensi Harian'
    const targetDateStr = filters.tanggal || new Date().toISOString().slice(0, 10)
    filterSummary = `Tanggal: ${targetDateStr}`
    fileName = `Rekap-Harian-${targetDateStr}.xlsx`

    const start = parseDate(targetDateStr)
    const end = parseDate(targetDateStr, true)

    const sesiList = await prisma.sesiAbsensi.findMany({
      where: {
        tanggal: { gte: start, lte: end },
        ...(filters.kelasIds && filters.kelasIds.length > 0 ? { jadwal: { kelasId: { in: filters.kelasIds } } } : {})
      },
      include: {
        jadwal: {
          include: {
            kelas: { select: { nama: true } },
            guru: { select: { nama: true } },
            ruangan: { select: { nama: true } }
          }
        },
        requests: {
          include: {
            siswa: { select: { nisn: true, nama: true } }
          },
          orderBy: { siswa: { nama: 'asc' } }
        }
      },
      orderBy: [{ jadwal: { kelas: { nama: 'asc' } } }, { jadwal: { jamMulai: 'asc' } }]
    })

    const workbook = createStyledWorkbook()
    const ws = workbook.addWorksheet('Rekap Harian')
    applyTitleBlock(ws, `REKAP PRESENSI HARIAN - ${targetDateStr}`, `Dicetak pada ${new Date().toLocaleString('id-ID')}`, 'I')

    const headerRow = ws.addRow(['No', 'Tanggal', 'Kelas', 'Mata Pelajaran', 'Guru', 'Ruangan', 'NISN', 'Nama Siswa', 'Status'])
    applyHeaderStyle(headerRow)

    let no = 1
    for (const sesi of sesiList) {
      for (const req of sesi.requests) {
        const row = ws.addRow([
          no++,
          targetDateStr,
          sesi.jadwal.kelas.nama,
          sesi.jadwal.mapel,
          sesi.jadwal.guru.nama,
          sesi.jadwal.ruangan.nama,
          req.siswa.nisn,
          req.siswa.nama,
          req.status
        ])
        applyDataRowStyle(row, no % 2 === 0)
      }
    }
    autoFitColumns(ws)
    fileBuffer = Buffer.from(await workbook.xlsx.writeBuffer())
  }

  // ==========================================
  // 2. REKAP BULANAN (XLSX)
  // ==========================================
  else if (jenis === 'rekap-bulanan') {
    reportTitle = 'Rekap Presensi Bulanan'
    const bulanStr = filters.bulan || new Date().toISOString().slice(0, 7)
    filterSummary = `Bulan: ${bulanStr}`
    fileName = `Rekap-Bulanan-${bulanStr}.xlsx`

    const [year, month] = bulanStr.split('-').map(Number)
    const startDate = new Date(Date.UTC(year, month - 1, 1))
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999))

    const kelasWhere = filters.kelasIds && filters.kelasIds.length > 0
      ? { id: { in: filters.kelasIds } }
      : (filters.semesterId ? { semesterId: filters.semesterId } : {})

    const kelasList = await prisma.kelas.findMany({
      where: kelasWhere,
      include: {
        siswa: {
          orderBy: { nama: 'asc' },
          include: {
            absensiRequests: {
              where: {
                sesi: {
                  tanggal: { gte: startDate, lte: endDate }
                }
              },
              select: { status: true }
            }
          }
        }
      },
      orderBy: { nama: 'asc' }
    })

    const workbook = createStyledWorkbook()
    const ws = workbook.addWorksheet('Rekap Bulanan')
    applyTitleBlock(ws, `REKAPITULASI PRESENSI SISWA - BULAN ${bulanStr}`, `Periode: ${bulanStr}`, 'J')

    const headerRow = ws.addRow(['No', 'Kelas', 'NISN', 'Nama Siswa', 'Hadir', 'Sakit', 'Izin', 'Alpha', 'Total Sesi', 'Kehadiran (%)'])
    applyHeaderStyle(headerRow)

    let no = 1
    for (const k of kelasList) {
      for (const s of k.siswa) {
        const hadir = s.absensiRequests.filter(r => r.status === 'HADIR').length
        const sakit = s.absensiRequests.filter(r => r.status === 'SAKIT').length
        const izin = s.absensiRequests.filter(r => r.status === 'IZIN').length
        const alpha = s.absensiRequests.filter(r => r.status === 'ALPHA').length
        const total = hadir + sakit + izin + alpha
        const persentase = total > 0 ? ((hadir / total) * 100).toFixed(1) + '%' : '0%'

        const row = ws.addRow([
          no++,
          k.nama,
          s.nisn,
          s.nama,
          hadir,
          sakit,
          izin,
          alpha,
          total,
          persentase
        ])
        applyDataRowStyle(row, no % 2 === 0)
      }
    }
    autoFitColumns(ws)
    fileBuffer = Buffer.from(await workbook.xlsx.writeBuffer())
  }

  // ==========================================
  // 3. REKAP KELAS (XLSX)
  // ==========================================
  else if (jenis === 'rekap-kelas') {
    reportTitle = 'Rekap Presensi Per Kelas'
    const tMulai = filters.tanggalMulai || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
    const tSelesai = filters.tanggalSelesai || new Date().toISOString().slice(0, 10)
    filterSummary = `Rentang: ${tMulai} s/d ${tSelesai}`
    fileName = `Rekap-Kelas-${tMulai}_sd_${tSelesai}.xlsx`

    const start = parseDate(tMulai)
    const end = parseDate(tSelesai, true)

    const sesi = await prisma.sesiAbsensi.findMany({
      where: {
        tanggal: { gte: start, lte: end },
        ...(filters.kelasIds && filters.kelasIds.length > 0 ? { jadwal: { kelasId: { in: filters.kelasIds } } } : {})
      },
      include: {
        jadwal: {
          include: {
            kelas: {
              include: {
                _count: { select: { siswa: true } },
                waliKelas: { select: { nama: true } }
              }
            }
          }
        },
        requests: {
          select: { status: true }
        }
      }
    })

    const kelasMap = new Map<number, {
      nama: string
      waliKelas: string
      totalMurid: number
      totalSesi: number
      hadir: number
      sakit: number
      izin: number
      alpha: number
    }>()

    for (const s of sesi) {
      const kId = s.jadwal.kelasId
      if (!kelasMap.has(kId)) {
        kelasMap.set(kId, {
          nama: s.jadwal.kelas.nama,
          waliKelas: s.jadwal.kelas.waliKelas?.nama || '-',
          totalMurid: s.jadwal.kelas._count.siswa,
          totalSesi: 0,
          hadir: 0,
          sakit: 0,
          izin: 0,
          alpha: 0
        })
      }
      const item = kelasMap.get(kId)!
      item.totalSesi++
      item.hadir += s.requests.filter(r => r.status === 'HADIR').length
      item.sakit += s.requests.filter(r => r.status === 'SAKIT').length
      item.izin += s.requests.filter(r => r.status === 'IZIN').length
      item.alpha += s.requests.filter(r => r.status === 'ALPHA').length
    }

    const workbook = createStyledWorkbook()
    const ws = workbook.addWorksheet('Rekap Kelas')
    applyTitleBlock(ws, `REKAP KEHADIRAN KELAS (${tMulai} s/d ${tSelesai})`, `Total Kelas: ${kelasMap.size}`, 'J')

    const headerRow = ws.addRow(['No', 'Kelas', 'Wali Kelas', 'Jumlah Siswa', 'Total Sesi', 'Hadir', 'Sakit', 'Izin', 'Alpha', 'Rata-rata Kehadiran'])
    applyHeaderStyle(headerRow)

    let no = 1
    for (const item of kelasMap.values()) {
      const totalExpected = item.totalMurid * item.totalSesi
      const persentase = totalExpected > 0 ? ((item.hadir / totalExpected) * 100).toFixed(1) + '%' : '0%'
      const row = ws.addRow([
        no++,
        item.nama,
        item.waliKelas,
        item.totalMurid,
        item.totalSesi,
        item.hadir,
        item.sakit,
        item.izin,
        item.alpha,
        persentase
      ])
      applyDataRowStyle(row, no % 2 === 0)
    }
    autoFitColumns(ws)
    fileBuffer = Buffer.from(await workbook.xlsx.writeBuffer())
  }

  // ==========================================
  // 4. REKAP PER SESI (XLSX)
  // ==========================================
  else if (jenis === 'rekap-sesi') {
    reportTitle = 'Rekap Presensi Per Sesi'
    const targetDate = filters.tanggal || new Date().toISOString().slice(0, 10)
    filterSummary = `Tanggal: ${targetDate}`
    fileName = `Rekap-Sesi-${targetDate}.xlsx`

    const start = parseDate(targetDate)
    const end = parseDate(targetDate, true)

    const sesiWhere: any = {
      tanggal: { gte: start, lte: end }
    }
    if (filters.sesiId) sesiWhere.id = filters.sesiId
    if (filters.kelasId) sesiWhere.jadwal = { kelasId: filters.kelasId }

    const sesiList = await prisma.sesiAbsensi.findMany({
      where: sesiWhere,
      include: {
        jadwal: {
          include: {
            kelas: { select: { nama: true } },
            guru: { select: { nama: true } },
            ruangan: { select: { nama: true } }
          }
        },
        requests: {
          include: {
            siswa: { select: { nisn: true, nama: true } }
          },
          orderBy: { siswa: { nama: 'asc' } }
        }
      },
      orderBy: [{ jadwal: { jamMulai: 'asc' } }]
    })

    const workbook = createStyledWorkbook()
    const ws = workbook.addWorksheet('Rekap Sesi')
    applyTitleBlock(ws, `REKAP PRESENSI SESI / JAM PELAJARAN - ${targetDate}`, `Jumlah Sesi: ${sesiList.length}`, 'J')

    const headerRow = ws.addRow(['No', 'Waktu', 'Kelas', 'Mata Pelajaran', 'Guru', 'Ruangan', 'NISN', 'Nama Siswa', 'Status', 'Keterangan'])
    applyHeaderStyle(headerRow)

    let no = 1
    for (const sesi of sesiList) {
      for (const req of sesi.requests) {
        const row = ws.addRow([
          no++,
          `${sesi.jadwal.jamMulai} - ${sesi.jadwal.jamSelesai}`,
          sesi.jadwal.kelas.nama,
          sesi.jadwal.mapel,
          sesi.jadwal.guru.nama,
          sesi.jadwal.ruangan.nama,
          req.siswa.nisn,
          req.siswa.nama,
          req.status,
          req.keterangan || '-'
        ])
        applyDataRowStyle(row, no % 2 === 0)
      }
    }
    autoFitColumns(ws)
    fileBuffer = Buffer.from(await workbook.xlsx.writeBuffer())
  }

  // ==========================================
  // 5. REKAP SEMESTER (XLSX)
  // ==========================================
  else if (jenis === 'rekap-semester') {
    reportTitle = 'Rekap Presensi Semester'
    const semId = filters.semesterId
    const semester = await prisma.semester.findFirst({
      where: semId ? { id: semId } : { isActive: true },
      include: { tahunAjaran: true }
    })

    const semLabel = semester ? `${semester.nama} (${semester.tahunAjaran.nama})` : 'Semester Berjalan'
    filterSummary = `Semester: ${semLabel}`
    fileName = `Rekap-Semester-${semester?.nama || 'Aktif'}.xlsx`

    const kelasWhere = semester ? { semesterId: semester.id } : {}
    const kelasList = await prisma.kelas.findMany({
      where: filters.kelasIds && filters.kelasIds.length > 0 ? { id: { in: filters.kelasIds } } : kelasWhere,
      include: {
        waliKelas: { select: { nama: true } },
        _count: { select: { siswa: true } },
        jadwalPelajaran: {
          include: {
            sesi: {
              where: { status: 'SELESAI' },
              include: { requests: { select: { status: true } } }
            }
          }
        }
      },
      orderBy: { nama: 'asc' }
    })

    const workbook = createStyledWorkbook()
    const ws = workbook.addWorksheet('Rekap Semester')
    applyTitleBlock(ws, `REKAPITULASI PRESENSI SEMESTER - ${semLabel}`, `Total Kelas: ${kelasList.length}`, 'J')

    const headerRow = ws.addRow(['No', 'Kelas', 'Wali Kelas', 'Jumlah Siswa', 'Total Sesi', 'Hadir', 'Sakit', 'Izin', 'Alpha', 'Persentase Kehadiran'])
    applyHeaderStyle(headerRow)

    let no = 1
    for (const k of kelasList) {
      let hadir = 0
      let sakit = 0
      let izin = 0
      let alpha = 0
      let totalSesi = 0

      for (const j of k.jadwalPelajaran) {
        for (const s of j.sesi) {
          totalSesi++
          hadir += s.requests.filter(r => r.status === 'HADIR').length
          sakit += s.requests.filter(r => r.status === 'SAKIT').length
          izin += s.requests.filter(r => r.status === 'IZIN').length
          alpha += s.requests.filter(r => r.status === 'ALPHA').length
        }
      }

      const totalExpected = k._count.siswa * totalSesi
      const persentase = totalExpected > 0 ? ((hadir / totalExpected) * 100).toFixed(1) + '%' : '0%'

      const row = ws.addRow([
        no++,
        k.nama,
        k.waliKelas?.nama || '-',
        k._count.siswa,
        totalSesi,
        hadir,
        sakit,
        izin,
        alpha,
        persentase
      ])
      applyDataRowStyle(row, no % 2 === 0)
    }
    autoFitColumns(ws)
    fileBuffer = Buffer.from(await workbook.xlsx.writeBuffer())
  }

  // ==========================================
  // 6. REKAP INDIVIDU MURID (XLSX)
  // ==========================================
  else if (jenis === 'rekap-individu') {
    reportTitle = 'Rekap Presensi Individu Murid'
    const siswaId = filters.siswaId
    if (!siswaId) {
      throw createError({ statusCode: 400, statusMessage: 'Siswa harus dipilih untuk laporan individu' })
    }

    const siswa = await prisma.siswa.findUnique({
      where: { id: siswaId },
      include: {
        kelas: {
          include: {
            waliKelas: { select: { nama: true } },
            semester: { include: { tahunAjaran: true } }
          }
        }
      }
    })

    if (!siswa) throw createError({ statusCode: 404, statusMessage: 'Data siswa tidak ditemukan' })

    const tMulai = filters.tanggalMulai || new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10)
    const tSelesai = filters.tanggalSelesai || new Date().toISOString().slice(0, 10)
    filterSummary = `${siswa.nama} (${siswa.kelas.nama}), ${tMulai} - ${tSelesai}`
    fileName = `Rekap-Individu-${siswa.nisn}-${siswa.nama.replace(/\s+/g, '_')}.xlsx`

    const start = parseDate(tMulai)
    const end = parseDate(tSelesai, true)

    const requests = await prisma.absensiRequest.findMany({
      where: {
        siswaId: siswa.id,
        sesi: {
          tanggal: { gte: start, lte: end }
        }
      },
      include: {
        sesi: {
          include: {
            jadwal: {
              include: {
                guru: { select: { nama: true } },
                ruangan: { select: { nama: true } }
              }
            }
          }
        }
      },
      orderBy: { sesi: { tanggal: 'desc' } }
    })

    const workbook = createStyledWorkbook()
    const ws = workbook.addWorksheet('Rekap Individu')
    applyTitleBlock(
      ws,
      `REKAP PRESENSI: ${siswa.nama.toUpperCase()} (${siswa.nisn})`,
      `Kelas: ${siswa.kelas.nama} | Wali Kelas: ${siswa.kelas.waliKelas?.nama || '-'} | Periode: ${tMulai} s/d ${tSelesai}`,
      'G'
    )

    const headerRow = ws.addRow(['No', 'Tanggal', 'Mata Pelajaran', 'Guru Pengampu', 'Jam', 'Status', 'Keterangan'])
    applyHeaderStyle(headerRow)

    let no = 1
    for (const r of requests) {
      const row = ws.addRow([
        no++,
        r.sesi.tanggal.toISOString().slice(0, 10),
        r.sesi.jadwal.mapel,
        r.sesi.jadwal.guru.nama,
        `${r.sesi.jadwal.jamMulai} - ${r.sesi.jadwal.jamSelesai}`,
        r.status,
        r.keterangan || '-'
      ])
      applyDataRowStyle(row, no % 2 === 0)
    }
    autoFitColumns(ws)
    fileBuffer = Buffer.from(await workbook.xlsx.writeBuffer())
  }

  // ==========================================
  // 7. REKAP IZIN & SAKIT (XLSX)
  // ==========================================
  else if (jenis === 'rekap-izin') {
    reportTitle = 'Rekap Izin & Sakit Murid'
    const tMulai = filters.tanggalMulai || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
    const tSelesai = filters.tanggalSelesai || new Date().toISOString().slice(0, 10)
    filterSummary = `Rentang: ${tMulai} s/d ${tSelesai} (${filters.statusIzin || 'Semua Status'})`
    fileName = `Rekap-Izin-Sakit-${tMulai}_sd_${tSelesai}.xlsx`

    const start = parseDate(tMulai)
    const end = parseDate(tSelesai, true)

    const izinWhere: any = {
      tanggal: { gte: start, lte: end }
    }
    if (filters.statusIzin && filters.statusIzin !== 'SEMUA') {
      izinWhere.status = filters.statusIzin
    }

    const izins = await prisma.izin.findMany({
      where: izinWhere,
      include: {
        siswa: {
          include: {
            kelas: { select: { nama: true } }
          }
        },
        penanggap: { select: { nama: true } }
      },
      orderBy: { tanggal: 'desc' }
    })

    const workbook = createStyledWorkbook()
    const ws = workbook.addWorksheet('Rekap Izin & Sakit')
    applyTitleBlock(ws, `REKAP PENGAJUAN IZIN & SAKIT (${tMulai} s/d ${tSelesai})`, `Total Pengajuan: ${izins.length}`, 'I')

    const headerRow = ws.addRow(['No', 'Tanggal', 'Kelas', 'NISN', 'Nama Siswa', 'Jenis', 'Keterangan', 'Status', 'Direspon Oleh'])
    applyHeaderStyle(headerRow)

    let no = 1
    for (const iz of izins) {
      const row = ws.addRow([
        no++,
        iz.tanggal.toISOString().slice(0, 10),
        iz.siswa.kelas.nama,
        iz.siswa.nisn,
        iz.siswa.nama,
        iz.jenis,
        iz.keterangan || '-',
        iz.status,
        iz.penanggap?.nama || '-'
      ])
      applyDataRowStyle(row, no % 2 === 0)
    }
    autoFitColumns(ws)
    fileBuffer = Buffer.from(await workbook.xlsx.writeBuffer())
  }

  // ==========================================
  // 8. DATA MURID (XLSX)
  // ==========================================
  else if (jenis === 'data-siswa') {
    reportTitle = 'Data Master Murid'
    filterSummary = filters.kelasId ? `Kelas ID: ${filters.kelasId}` : 'Semua Kelas'
    fileName = `Data-Murid-${new Date().toISOString().slice(0, 10)}.xlsx`

    const siswaWhere = filters.kelasId ? { kelasId: filters.kelasId } : {}
    const siswaList = await prisma.siswa.findMany({
      where: siswaWhere,
      include: {
        kelas: { select: { nama: true } },
        user: { select: { email: true } }
      },
      orderBy: [{ kelas: { nama: 'asc' } }, { nama: 'asc' }]
    })

    const workbook = createStyledWorkbook()
    const ws = workbook.addWorksheet('Data Murid')
    applyTitleBlock(ws, 'DATA MASTER SISWA', `Total Murid: ${siswaList.length}`, 'H')

    const headerRow = ws.addRow(['No', 'NISN', 'Nama Siswa', 'Kelas', 'Email Akun', 'Nama Wali', 'No HP Wali 1', 'No HP Wali 2'])
    applyHeaderStyle(headerRow)

    let no = 1
    for (const s of siswaList) {
      const row = ws.addRow([
        no++,
        s.nisn,
        s.nama,
        s.kelas.nama,
        s.user?.email || '-',
        s.namaWali || '-',
        s.kontakWali || '-',
        s.kontakWali2 || '-'
      ])
      applyDataRowStyle(row, no % 2 === 0)
    }
    autoFitColumns(ws)
    fileBuffer = Buffer.from(await workbook.xlsx.writeBuffer())
  }

  // ==========================================
  // 9. DATA PTK (XLSX)
  // ==========================================
  else if (jenis === 'data-guru') {
    reportTitle = 'Data Master PTK'
    filterSummary = 'Semua Guru & Tendik'
    fileName = `Data-PTK-${new Date().toISOString().slice(0, 10)}.xlsx`

    const ptkList = await prisma.user.findMany({
      where: { role: 'GURU' },
      include: {
        kelasWali: { select: { nama: true } }
      },
      orderBy: { nama: 'asc' }
    })

    const workbook = createStyledWorkbook()
    const ws = workbook.addWorksheet('Data PTK')
    applyTitleBlock(ws, 'DATA MASTER PENDIDIK & TENAGA KEPENDIDIKAN (PTK)', `Total PTK: ${ptkList.length}`, 'G')

    const headerRow = ws.addRow(['No', 'Nama Lengkap', 'NIP', 'Email', 'No HP', 'Status Akun', 'Wali Kelas'])
    applyHeaderStyle(headerRow)

    let no = 1
    for (const p of ptkList) {
      const waliKelasStr = p.kelasWali.map(k => k.nama).join(', ') || '-'
      const row = ws.addRow([
        no++,
        p.nama,
        p.nip || '-',
        p.email,
        p.nomorHp1 || '-',
        p.isActive ? 'Aktif' : 'Nonaktif',
        waliKelasStr
      ])
      applyDataRowStyle(row, no % 2 === 0)
    }
    autoFitColumns(ws)
    fileBuffer = Buffer.from(await workbook.xlsx.writeBuffer())
  }

  // ==========================================
  // 10. DATA KELAS (XLSX)
  // ==========================================
  else if (jenis === 'data-kelas') {
    reportTitle = 'Data Master Kelas'
    filterSummary = 'Semua Data Kelas'
    fileName = `Data-Kelas-${new Date().toISOString().slice(0, 10)}.xlsx`

    const kelasList = await prisma.kelas.findMany({
      include: {
        waliKelas: { select: { nama: true, nip: true } },
        semester: { include: { tahunAjaran: true } },
        _count: { select: { siswa: true, jadwalPelajaran: true } }
      },
      orderBy: { nama: 'asc' }
    })

    const workbook = createStyledWorkbook()
    const ws = workbook.addWorksheet('Data Kelas')
    applyTitleBlock(ws, 'DATA MASTER KELAS & ROMBEL', `Total Kelas: ${kelasList.length}`, 'G')

    const headerRow = ws.addRow(['No', 'Nama Kelas', 'Wali Kelas', 'NIP Wali', 'Semester / Tahun Ajaran', 'Jumlah Siswa', 'Jumlah Mapel/Jadwal'])
    applyHeaderStyle(headerRow)

    let no = 1
    for (const k of kelasList) {
      const row = ws.addRow([
        no++,
        k.nama,
        k.waliKelas?.nama || '-',
        k.waliKelas?.nip || '-',
        `${k.semester.nama} (${k.semester.tahunAjaran.nama})`,
        k._count.siswa,
        k._count.jadwalPelajaran
      ])
      applyDataRowStyle(row, no % 2 === 0)
    }
    autoFitColumns(ws)
    fileBuffer = Buffer.from(await workbook.xlsx.writeBuffer())
  } else {
    throw createError({ statusCode: 400, statusMessage: `Tipe export "${jenis}" tidak dikenal` })
  }

  // Save to ExportHistory
  try {
    await prisma.exportHistory.create({
      data: {
        userId,
        jenis,
        judul: reportTitle,
        filterJson: JSON.stringify(filters),
        filterLabel: filterSummary || '-',
        format: 'xlsx',
        fileName,
        fileSize: fileBuffer ? fileBuffer.length : 0
      }
    })
  } catch (err) {
    console.error('Gagal mencatat export history:', err)
  }

  setResponseHeader(event, 'Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  setResponseHeader(event, 'Content-Disposition', `attachment; filename="${fileName}"`)

  return fileBuffer
})
