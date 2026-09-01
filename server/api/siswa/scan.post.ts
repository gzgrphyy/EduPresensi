import { z } from 'zod'

const bodySchema = z.object({
  qrCode: z.string().min(1, 'QR Code tidak boleh kosong')
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session.user) {
    throw createError({ statusCode: 401, statusMessage: 'Silakan login terlebih dahulu' })
  }

  const user = session.user
  const siswa = await prisma.siswa.findUnique({ where: { userId: user.id } })
  if (!siswa) {
    throw createError({ statusCode: 404, statusMessage: 'Data murid tidak ditemukan' })
  }

  const result = bodySchema.safeParse(await readBody(event))
  if (!result.success) {
    throw createError({ statusCode: 400, statusMessage: result.error.issues[0].message })
  }

  const { qrCode } = result.data

  const ruangan = await prisma.ruangan.findUnique({ where: { qrCode } })
  if (!ruangan) {
    throw createError({ statusCode: 404, statusMessage: 'QR Code tidak valid' })
  }

  const checkin = await checkinSiswaRuangan(siswa, ruangan.id)

  if (!checkin.success) {
    const message = checkin.reason === 'ALL_DONE'
      ? 'Sesi di ruangan ini hari ini sudah selesai.'
      : checkin.reason === 'ALREADY_SCANNED'
        ? 'Kamu sudah absen di ruangan ini hari ini.'
        : 'Tidak ada jadwal kelasmu di ruangan ini hari ini.'
    return {
      success: false,
      blocked: checkin.reason === 'ALREADY_SCANNED',
      message,
      ruangan: { id: ruangan.id, nama: ruangan.nama }
    }
  }

  const scannedAt = new Date()

  // Ambil info sesi untuk data guru berhalangan
  let sesiInfo: { mapel: string; kelas: string; jamMulai: string; jamSelesai: string; guru: string; isGuruBerhalangan: boolean; petugasPiketNama: string | null } | null = null
  if (checkin.info) {
    const today = todayDate()
    const hari = hariIni(new Date()) as any
    const jadwal = await prisma.jadwalPelajaran.findFirst({
      where: {
        kelas: { nama: checkin.info.kelas },
        mapel: checkin.info.mapel,
        hari
      },
      select: {
        id: true,
        mapel: true,
        jamMulai: true,
        jamSelesai: true,
        kelas: { select: { nama: true } },
        guru: { select: { nama: true } }
      }
    })
    if (jadwal) {
      const sesi = await prisma.sesiAbsensi.findFirst({
        where: { jadwalId: jadwal.id, tanggal: today },
        select: { isGuruBerhalangan: true, petugasPiketNama: true }
      })
      sesiInfo = {
        mapel: checkin.info.mapel,
        kelas: checkin.info.kelas,
        jamMulai: checkin.info.jamMulai,
        jamSelesai: checkin.info.jamSelesai,
        guru: checkin.info.guru,
        isGuruBerhalangan: sesi?.isGuruBerhalangan || false,
        petugasPiketNama: sesi?.petugasPiketNama || null
      }
    }
  }

  return {
    success: true,
    alreadyScanned: checkin.alreadyScanned,
    message: checkin.alreadyScanned
      ? 'Kamu sudah absen di ruangan ini hari ini.'
      : `Absensi tercatat untuk ${checkin.jumlahSesi} sesi pelajaran di ruangan ini hari ini. Menunggu konfirmasi guru.`,
    status: 'PENDING',
    scannedAt: scannedAt.toISOString(),
    ruangan: { id: ruangan.id, nama: ruangan.nama },
    sesi: sesiInfo
  }
})