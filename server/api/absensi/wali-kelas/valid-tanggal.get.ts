export default defineEventHandler(async (event) => {
  const user = (await getUserSession(event)).user!
  if (user.role !== 'GURU') {
    throw createError({ statusCode: 403, statusMessage: 'Akses ditolak' })
  }

  const query = getQuery(event)
  const kelasId = parseInt(query.kelasId as string)
  if (!kelasId) {
    return { validDates: [] }
  }

  try {
    const sesiList = await prisma.sesiAbsensi.findMany({
      where: {
        jadwal: { kelasId }
      },
      select: { tanggal: true }
    })

    const set = new Set<string>()
    for (const s of sesiList) {
      const dateStr = s.tanggal.toISOString().split('T')[0]
      set.add(dateStr)
    }

    return { validDates: Array.from(set) }
  } catch (err: any) {
    console.error('[wali-kelas/valid-tanggal] error:', err)
    return { validDates: [] }
  }
})
