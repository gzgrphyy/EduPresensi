import ExcelJS from 'exceljs'

export default defineEventHandler(async (event) => {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('Template PTK')

  worksheet.columns = [
    { header: 'Nama', key: 'nama', width: 25 },
    { header: 'Email', key: 'email', width: 30 },
    { header: 'NIP', key: 'nip', width: 20 },
    { header: 'No HP 1', key: 'nomorHp1', width: 15 },
    { header: 'No HP 2', key: 'nomorHp2', width: 15 },
    { header: 'Jenis Kelamin', key: 'jenisKelamin', width: 15 }
  ]

  worksheet.addRow({ nama: 'Budi Santoso', email: 'budi@sekolah.sch.id', nip: '198501012010011001', nomorHp1: '081234567890', nomorHp2: '089876543210', jenisKelamin: 'LAKI_LAKI' })

  const buffer = await workbook.xlsx.writeBuffer()

  setResponseHeader(event, 'Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  setResponseHeader(event, 'Content-Disposition', 'attachment; filename=template-import-ptk.xlsx')

  return buffer
})
