import ExcelJS from 'exceljs'
import { createStyledWorkbook, applyHeaderStyle, applyTitleBlock, autoFitColumns, applyDataRowStyle } from '~~/server/utils/export-excel'

const bulanLabels = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
]

export default defineEventHandler(async (event) => {
  const user = (await getUserSession(event)).user!
  await finalizeExpiredSesi()

  const query = getQuery(event)
  const bulan = query.bulan ? Number(query.bulan) : null
  const tahun = query.tahun ? Number(query.tahun) : null

  if (bulan !== null && (bulan < 1 || bulan > 12)) {
    throw createError({ statusCode: 400, statusMessage: 'Bulan tidak valid' })
  }
  if (tahun !== null && (tahun < 2000 || tahun > 2100)) {
    throw createError({ statusCode: 400, statusMessage: 'Tahun tidak valid' })
  }

  const tanggalWhere: { gte?: Date; lte?: Date } = {}
  if (tahun !== null) {
    tanggalWhere.gte = new Date(Date.UTC(tahun, (bulan ?? 1) - 1, 1))
    tanggalWhere.lte = new Date(Date.UTC(tahun, bulan ?? 12, 0, 23, 59, 59, 999))
  }

  const sesiList = await prisma.sesiAbsensi.findMany({
    where: {
      status: 'SELESAI',
      jadwal: { guruId: user.id },
      ...(tanggalWhere.gte ? { tanggal: tanggalWhere } : {})
    },
    include: {
      jadwal: {
        select: {
          mapel: true,
          kelas: { select: { id: true, nama: true, _count: { select: { siswa: true } } } },
          ruangan: { select: { id: true, nama: true } }
        }
      },
      requests: {
        select: { status: true }
      }
    },
    orderBy: { tanggal: 'desc' }
  })

  const rows = sesiList.map(s => {
    const totalSiswa = s.jadwal.kelas._count.siswa
    const hadir = s.requests.filter(r => r.status === 'HADIR').length
    const sakit = s.requests.filter(r => r.status === 'SAKIT').length
    const izin = s.requests.filter(r => r.status === 'IZIN').length
    const alpha = s.requests.filter(r => r.status === 'ALPHA').length
    const persentase = totalSiswa > 0 ? Number(((hadir / totalSiswa) * 100).toFixed(1)) : 0
    return {
      tanggal: s.tanggal.toISOString().split('T')[0],
      mapel: s.jadwal.mapel,
      kelas: s.jadwal.kelas.nama,
      ruangan: s.jadwal.ruangan.nama,
      totalSiswa,
      hadir,
      sakit,
      izin,
      alpha,
      persentase
    }
  })

  const periodeLabel = tahun !== null
    ? `${bulan !== null ? bulanLabels[bulan - 1] : 'Semua Bulan'} ${tahun}`
    : 'Semua Periode'
  const fileName = `Riwayat-Absensi-${user.nama.replace(/\s+/g, '_')}-${periodeLabel.replace(/\s+/g, '_')}.xlsx`

  const workbook = createStyledWorkbook()
  const ws = workbook.addWorksheet('Riwayat Absensi')
  applyTitleBlock(
    ws,
    `RIWAYAT ABSENSI GURU: ${user.nama.toUpperCase()}`,
    `Periode: ${periodeLabel} | ${rows.length} sesi`,
    'K'
  )

  const headerRow = ws.addRow(['No', 'Tanggal', 'Mata Pelajaran', 'Kelas', 'Ruangan', 'Total Siswa', 'Hadir', 'Sakit', 'Izin', 'Alpha', 'Persentase'])
  applyHeaderStyle(headerRow)

  let no = 1
  for (const r of rows) {
    const row = ws.addRow([
      no++,
      r.tanggal,
      r.mapel,
      r.kelas,
      r.ruangan,
      r.totalSiswa,
      r.hadir,
      r.sakit,
      r.izin,
      r.alpha,
      `${r.persentase}%`
    ])
    applyDataRowStyle(row, no % 2 === 0)
  }
  autoFitColumns(ws)

  const fileBuffer = Buffer.from(await workbook.xlsx.writeBuffer())

  setResponseHeader(event, 'Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  setResponseHeader(event, 'Content-Disposition', `attachment; filename="${fileName}"`)

  return fileBuffer
})
