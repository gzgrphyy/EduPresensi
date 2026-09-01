import { z } from 'zod'

export const createJadwalPiketSchema = z.object({
  petugasPiketId: z.number().int().positive('Petugas piket wajib dipilih'),
  hari: z.enum(['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU', 'MINGGU']),
  jamMulai: z.string().regex(/^\d{2}:\d{2}$/, 'Format jam mulai: HH:MM'),
  jamSelesai: z.string().regex(/^\d{2}:\d{2}$/, 'Format jam selesai: HH:MM')
}).refine(data => data.jamMulai < data.jamSelesai, {
  message: 'Jam mulai harus sebelum jam selesai',
  path: ['jamSelesai']
})

export const updateJadwalPiketSchema = z.object({
  petugasPiketId: z.number().int().positive().optional(),
  hari: z.enum(['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU', 'MINGGU']).optional(),
  jamMulai: z.string().regex(/^\d{2}:\d{2}$/, 'Format jam mulai: HH:MM').optional(),
  jamSelesai: z.string().regex(/^\d{2}:\d{2}$/, 'Format jam selesai: HH:MM').optional(),
  isActive: z.boolean().optional()
})
