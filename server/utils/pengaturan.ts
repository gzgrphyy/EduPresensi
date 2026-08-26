export const DEFAULT_ABSENSI = {
  autoTutupSesi: true,
  notifikasi: true,
  izinTeksBebas: false,
}

export async function getAbsensiSettings() {
  const pengaturan = await prisma.pengaturan.findFirst({
    select: {
      autoTutupSesi: true,
      notifikasi: true,
      izinTeksBebas: true,
    },
  })

  return {
    autoTutupSesi: pengaturan?.autoTutupSesi ?? DEFAULT_ABSENSI.autoTutupSesi,
    notifikasi: pengaturan?.notifikasi ?? DEFAULT_ABSENSI.notifikasi,
    izinTeksBebas: pengaturan?.izinTeksBebas ?? DEFAULT_ABSENSI.izinTeksBebas,
  }
}
