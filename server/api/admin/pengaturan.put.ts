import { z } from 'zod'

const pengaturanSchema = z.object({
  umum: z.object({
    namaSekolah: z.string().min(1).max(200),
    logoSekolahPath: z.string().nullable().optional(),
    alamat: z.string().max(500).optional().default(''),
    telp: z.string().max(20).optional().default(''),
    email: z.union([z.string().email().max(150), z.literal('')]).optional().default(''),
    tahunAjaran: z.string().max(20).optional().default(''),
    semester: z.string().max(20).optional().default(''),
    kepalaSekolah: z.string().max(100).optional().default(''),
    nipKepsek: z.string().max(30).optional().default(''),
  }),
  branding: z.object({
    namaAplikasi: z.string().min(1).max(100).optional(),
    titelAplikasi: z.string().min(1).max(100).optional(),
    iconPath: z.string().nullable().optional(),
    faviconPath: z.string().nullable().optional(),
    warnaUtama: z.string().regex(/^#[0-9a-fA-F]{3,8}$/).optional(),
  }).optional(),
  absensi: z.object({
    batasScan: z.number().int().min(1).max(60),
    autoTutupSesi: z.boolean(),
    batasTelat: z.number().int().min(0).max(120),
    notifikasi: z.boolean(),
    toleransiAlpha: z.number().int().min(0).max(20),
    izinTeksBebas: z.boolean(),
  }),
  keamanan: z.object({
    minimalPassword: z.number().int().min(4).max(32),
    sesiTimeout: z.number().int().min(5).max(480),
    maxLogin: z.number().int().min(1).max(10),
    twoFactorAuth: z.boolean(),
    logAktivitas: z.boolean(),
  }),
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = pengaturanSchema.parse(body)

  const existing = await prisma.pengaturan.findFirst()

  const data: any = {}

  if (parsed.umum) {
    data.namaSekolah = parsed.umum.namaSekolah
    data.alamat = parsed.umum.alamat
    data.telp = parsed.umum.telp
    data.email = parsed.umum.email
    data.tahunAjaran = parsed.umum.tahunAjaran
    data.semester = parsed.umum.semester
    data.kepalaSekolah = parsed.umum.kepalaSekolah
    data.nipKepsek = parsed.umum.nipKepsek
    if (parsed.umum.logoSekolahPath !== undefined) {
      data.logoSekolahPath = parsed.umum.logoSekolahPath
    }
  }

  if (parsed.branding) {
    // namaAplikasi & titelAplikasi tidak dikelola dari form (pakai i18n)
    if (parsed.branding.iconPath !== undefined) {
      data.iconPath = parsed.branding.iconPath
    }
    if (parsed.branding.faviconPath !== undefined) {
      data.faviconPath = parsed.branding.faviconPath
    }
    if (parsed.branding.warnaUtama !== undefined) {
      data.warnaUtama = parsed.branding.warnaUtama
    }
  }

  if (parsed.keamanan) {
    data.minimalPassword = parsed.keamanan.minimalPassword
    data.sesiTimeout = parsed.keamanan.sesiTimeout
    data.maxLogin = parsed.keamanan.maxLogin
  }

  if (existing) {
    await prisma.pengaturan.update({
      where: { id: existing.id },
      data,
    })
  } else {
    await prisma.pengaturan.create({
      data: {
        namaSekolah: data.namaSekolah || 'SMK Negeri 1 Bandung',
        logoSekolahPath: data.logoSekolahPath || null,
        alamat: data.alamat || '',
        telp: data.telp || '',
        email: data.email || '',
        tahunAjaran: data.tahunAjaran || '',
        semester: data.semester || '',
        kepalaSekolah: data.kepalaSekolah || '',
        nipKepsek: data.nipKepsek || '',
        namaAplikasi: data.namaAplikasi || 'Aplikasi Skoria',
        titelAplikasi: data.titelAplikasi || 'EduPresensi | Sistem Absensi Digital',
        iconPath: data.iconPath || null,
        faviconPath: data.faviconPath || null,
        warnaUtama: data.warnaUtama || '#0A66A0',
        minimalPassword: parsed.keamanan?.minimalPassword ?? 8,
        sesiTimeout: parsed.keamanan?.sesiTimeout ?? 60,
        maxLogin: parsed.keamanan?.maxLogin ?? 3,
      }
    })
  }

  return {
    success: true,
    message: 'Pengaturan berhasil disimpan',
    data: parsed
  }
})
