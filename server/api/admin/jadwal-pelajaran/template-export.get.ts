import ExcelJS from 'exceljs'

export default defineEventHandler(async (event) => {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('Template Jadwal')

  worksheet.columns = [
    { header: 'Hari', key: 'hari', width: 12 },
    { header: 'Jam Mulai', key: 'jamMulai', width: 12 },
    { header: 'Jam Selesai', key: 'jamSelesai', width: 13 },
    { header: 'Mapel', key: 'mapel', width: 25 },
    { header: 'Kelas', key: 'kelas', width: 15 },
    { header: 'Ruangan', key: 'ruangan', width: 18 },
    { header: 'Guru Pengampu', key: 'guruPengampu', width: 25 },
    { header: 'PTK Pendamping', key: 'ptkPendamping', width: 25 }
  ]

  worksheet.addRow({ hari: 'SENIN', jamMulai: '07:00', jamSelesai: '08:30', mapel: 'Matematika', kelas: 'X-A', ruangan: 'Ruang 1', guruPengampu: 'Budi Santoso', ptkPendamping: '' })

  const buffer = await workbook.xlsx.writeBuffer()

  setResponseHeader(event, 'Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  setResponseHeader(event, 'Content-Disposition', 'attachment; filename=template-import-jadwal-pelajaran.xlsx')

  return buffer
})
