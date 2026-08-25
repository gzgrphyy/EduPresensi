const DEFAULT_KEAMANAN = {
  minimalPassword: 8,
  sesiTimeout: 60,
  maxLogin: 3,
}

export async function getKeamananSettings() {
  const pengaturan = await prisma.pengaturan.findFirst({
    select: { minimalPassword: true, sesiTimeout: true, maxLogin: true },
  })
  return {
    minimalPassword: pengaturan?.minimalPassword ?? DEFAULT_KEAMANAN.minimalPassword,
    sesiTimeout: pengaturan?.sesiTimeout ?? DEFAULT_KEAMANAN.sesiTimeout,
    maxLogin: pengaturan?.maxLogin ?? DEFAULT_KEAMANAN.maxLogin,
  }
}
