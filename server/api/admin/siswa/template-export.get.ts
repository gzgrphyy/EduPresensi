import ExcelJS from 'exceljs'

export default defineEventHandler(async (event) => {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('Template Siswa')

  worksheet.columns = [
    { header: 'NISN', key: 'nisn', width: 15 },
    { header: 'Nama', key: 'nama', width: 25 },
    { header: 'Email', key: 'email', width: 30 },
    { header: 'Kelas ID', key: 'kelasId', width: 12 },
    { header: 'Jenis Kelamin', key: 'jenisKelamin', width: 15 },
    { header: 'Nama Wali', key: 'namaWali', width: 25 },
    { header: 'Email Wali', key: 'emailWali', width: 30 },
    { header: 'Kontak Wali', key: 'kontakWali', width: 15 },
    { header: 'Kontak Wali 2', key: 'kontakWali2', width: 15 },
    { header: 'No HP 1', key: 'nomorHp1', width: 15 },
    { header: 'No HP 2', key: 'nomorHp2', width: 15 }
  ]

  worksheet.addRow({ nisn: '1234567890', nama: 'Ahmad Rizki', email: 'ahmad@sekolah.sch.id', kelasId: 1, jenisKelamin: 'LAKI_LAKI', namaWali: 'Bapak Ahmad', emailWali: 'ayah@gmail.com', kontakWali: '081234567890', kontakWali2: '089876543210', nomorHp1: '081234567890', nomorHp2: '089876543210' })

  const buffer = await workbook.xlsx.writeBuffer()

  setResponseHeader(event, 'Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  setResponseHeader(event, 'Content-Disposition', 'attachment; filename=template-import-siswa.xlsx')

  return buffer
})
