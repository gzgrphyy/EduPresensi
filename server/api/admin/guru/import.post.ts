import { z } from 'zod'
import { generatePassword, hashPassword } from '../../../utils/password'
import { dummyAvatarPath } from '../../../utils/avatar'

const importGuruSchema = z.object({
  items: z.array(z.object({
    nama: z.string().min(1, 'Nama lengkap wajib diisi'),
    email: z.string().email('Format email tidak valid'),
    nip: z.string().max(18, 'NIP maksimal 18 digit').optional().nullable(),
    nomorHp1: z.string().max(20).optional().nullable(),
    nomorHp2: z.string().max(20).optional().nullable(),
    jenisKelamin: z.enum(['LAKI_LAKI', 'PEREMPUAN']).optional().nullable()
  })).min(1, 'Data tidak boleh kosong')
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const result = importGuruSchema.safeParse(body)
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
  const existingNips = new Set<string>()

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

    if (!item.jenisKelamin) {
      summary.failed++
      summary.errors.push({ row: rowIndex, error: 'Jenis kelamin wajib diisi' })
      continue
    }

    if (!item.nip || !item.nip.trim()) {
      summary.failed++
      summary.errors.push({ row: rowIndex, error: 'NIP wajib diisi' })
      continue
    }

    if (!item.nomorHp1 || !item.nomorHp1.trim()) {
      summary.failed++
      summary.errors.push({ row: rowIndex, error: 'No. HP 1 wajib diisi' })
      continue
    }

    const emailLower = item.email.trim().toLowerCase()
    const nipClean = item.nip.trim()

    if (existingEmails.has(emailLower)) {
      summary.failed++
      summary.errors.push({ row: rowIndex, error: `Email "${item.email}" duplikat dalam file` })
      continue
    }

    if (existingNips.has(nipClean)) {
      summary.failed++
      summary.errors.push({ row: rowIndex, error: `NIP "${item.nip}" duplikat dalam file` })
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

    const existingNip = await prisma.user.findUnique({
      where: { nip: nipClean }
    })
    if (existingNip) {
      summary.failed++
      summary.errors.push({ row: rowIndex, error: `NIP "${item.nip}" sudah digunakan` })
      existingNips.add(nipClean)
      continue
    }

    existingEmails.add(emailLower)
    existingNips.add(nipClean)

    const rawPassword = generatePassword(10)
    const passwordHash = hashPassword(rawPassword)

    try {
      await prisma.user.create({
        data: {
          nama: item.nama.trim(),
          email: emailLower,
          nip: nipClean,
          nomorHp1: item.nomorHp1?.trim() || null,
          nomorHp2: item.nomorHp2?.trim() || null,
          jenisKelamin: item.jenisKelamin,
          foto: dummyAvatarPath(item.nama.trim(), item.jenisKelamin),
          passwordHash,
          role: 'GURU',
          isActive: true
        }
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
