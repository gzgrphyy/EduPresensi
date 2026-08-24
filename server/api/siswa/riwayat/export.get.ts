import ExcelJS from 'exceljs'
import { createStyledWorkbook, applyHeaderStyle, applyTitleBlock, autoFitColumns, applyDataRowStyle } from '~~/server/utils/export-excel'

const bulanLabels = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
]

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const siswa = await prisma.siswa.findUnique({
    where: { userId: session.user.id },
    include: { kelas: { select: { nama: true } } }
  })
  if (!siswa) {
    throw createError({ statusCode: 404, statusMessage: 'Data murid tidak ditemukan' })
  }

  const query = getQuery(event)
  const bulan = query.bulan ? Number(query.bulan) : null
  const tahun = query.tahun ? Number(query.tahun) : null
  const status = typeof query.status === 'string' && query.status ? query.status.toUpperCase() : null

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

  const requests = await prisma.absensiRequest.findMany({
    where: {
      siswaId: siswa.id,
      ...(status ? { status } : {}),
      ...(tanggalWhere.gte ? { sesi: { tanggal: tanggalWhere } } : {})
    },
    include: {
      sesi: {
        include: {
          jadwal: {
            select: {
              mapel: true,
              kelas: { select: { nama: true } },
              guru: { select: { nama: true } }
            }
          }
        }
      }
    },
    orderBy: { sesi: { tanggal: 'desc' } }
  })

  const periodeLabel = tahun !== null
    ? `${bulan !== null ? bulanLabels[bulan - 1] : 'Semua Bulan'} ${tahun}`
    : 'Semua Periode'
  const fileName = `Riwayat-Absensi-${siswa.nisn}-${periodeLabel.replace(/\s+/g, '_')}.xlsx`

  const workbook = createStyledWorkbook()
  const ws = workbook.addWorksheet('Riwayat Absensi')
  applyTitleBlock(
    ws,
    `RIWAYAT ABSENSI: ${siswa.nama.toUpperCase()} (${siswa.nisn})`,
    `Kelas: ${siswa.kelas?.nama || '-'} | Periode: ${periodeLabel}${status ? ` | Status: ${status}` : ''}`,
    'H'
  )

  const headerRow = ws.addRow(['No', 'Tanggal', 'Mata Pelajaran', 'Kelas', 'Guru Pengampu', 'Jam Absen', 'Status', 'Keterangan'])
  applyHeaderStyle(headerRow)

  let no = 1
  for (const r of requests) {
    const jamAbsen = r.scannedAt
      ? r.scannedAt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })
      : '-'
    const row = ws.addRow([
      no++,
      r.sesi.tanggal.toISOString().slice(0, 10),
      r.sesi.jadwal.mapel,
      r.sesi.jadwal.kelas.nama,
      r.sesi.jadwal.guru.nama,
      jamAbsen,
      r.status,
      r.keterangan || '-'
    ])
    applyDataRowStyle(row, no % 2 === 0)
  }
  autoFitColumns(ws)

  const fileBuffer = Buffer.from(await workbook.xlsx.writeBuffer())

  setResponseHeader(event, 'Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  setResponseHeader(event, 'Content-Disposition', `attachment; filename="${fileName}"`)

  return fileBuffer
})
