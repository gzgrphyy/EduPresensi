import { z } from 'zod'
import { generatePassword, hashPassword } from '../../../utils/password'
import { dummyAvatarPath } from '../../../utils/avatar'

const importSiswaSchema = z.object({
  items: z.array(z.object({
    nisn: z.string().regex(/^\d{10}$/, 'NISN harus tepat 10 digit angka'),
    nama: z.string().min(1, 'Nama siswa wajib diisi'),
    email: z.string().email('Format email tidak valid'),
    kelasId: z.number().int().positive('Kelas ID harus berupa angka positif'),
    jenisKelamin: z.enum(['LAKI_LAKI', 'PEREMPUAN']),
    namaWali: z.string().optional().nullable(),
    emailWali: z.string().email('Format email wali tidak valid').optional().nullable(),
    kontakWali: z.string().max(20).optional().nullable(),
    kontakWali2: z.string().max(20).optional().nullable(),
    nomorHp1: z.string().max(20).optional().nullable(),
    nomorHp2: z.string().max(20).optional().nullable()
  })).min(1, 'Data tidak boleh kosong')
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const result = importSiswaSchema.safeParse(body)
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

  const existingEmails = new Set<string>()
  const existingNisns = new Set<string>()

  for (const item of items) {
    const rowIndex = items.indexOf(item) + 1

    if (!item.nama.trim()) {
      summary.failed++
      summary.errors.push({ row: rowIndex, error: 'Nama lengkap wajib diisi' })
      continue
    }

    if (!item.email.trim()) {
      summary.failed++
      summary.errors.push({ row: rowIndex, error: 'Email wajib diisi' })
      continue
    }

    if (!item.kelasId || item.kelasId <= 0) {
      summary.failed++
      summary.errors.push({ row: rowIndex, error: 'Kelas wajib diisi' })
      continue
    }

    const emailLower = item.email.trim().toLowerCase()
    const nisnClean = item.nisn.trim()

    if (existingEmails.has(emailLower)) {
      summary.failed++
      summary.errors.push({ row: rowIndex, error: `Email "${item.email}" duplikat dalam file` })
      continue
    }

    if (existingNisns.has(nisnClean)) {
      summary.failed++
      summary.errors.push({ row: rowIndex, error: `NISN "${item.nisn}" duplikat dalam file` })
      continue
    }

    const existingNisn = await prisma.siswa.findUnique({ where: { nisn: nisnClean } })
    if (existingNisn) {
      summary.failed++
      summary.errors.push({ row: rowIndex, error: `NISN "${item.nisn}" sudah digunakan` })
      existingNisns.add(nisnClean)
      continue
    }

    const existingEmail = await prisma.user.findUnique({
      where: { email: emailLower }
    })
    if (existingEmail) {
      summary.failed++
      summary.errors.push({ row: rowIndex, error: `Email "${item.email}" sudah digunakan` })
      existingEmails.add(emailLower)
      continue
    }

    const kelas = await prisma.kelas.findUnique({ where: { id: item.kelasId } })
    if (!kelas) {
      summary.failed++
      summary.errors.push({ row: rowIndex, error: `Kelas dengan ID ${item.kelasId} tidak ditemukan` })
      continue
    }

    existingEmails.add(emailLower)
    existingNisns.add(nisnClean)

    const rawPassword = generatePassword(10)
    const passwordHash = hashPassword(rawPassword)

    try {
      await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            nama: item.nama.trim(),
            email: emailLower,
            passwordHash,
            role: 'SISWA',
            isActive: true,
            jenisKelamin: item.jenisKelamin,
            foto: dummyAvatarPath(item.nama.trim(), item.jenisKelamin)
          }
        })

        await tx.siswa.create({
          data: {
            userId: user.id,
            nisn: nisnClean,
            nama: item.nama.trim(),
            kelasId: item.kelasId,
            namaWali: item.namaWali?.trim() || null,
            emailWali: item.emailWali?.trim() || null,
            kontakWali: item.kontakWali?.trim() || null,
            kontakWali2: item.kontakWali2?.trim() || null,
            nomorHp1: item.nomorHp1?.trim() || null,
            nomorHp2: item.nomorHp2?.trim() || null
          }
        })
      })
      summary.success++
    } catch (err: any) {
      summary.failed++
      summary.errors.push({ row: rowIndex, error: err.message || 'Gagal membuat akun' })
    }
  }

  return {
    summary,
    message: `Import selesai. Berhasil: ${summary.success}, Gagal: ${summary.failed}`
  }
})
