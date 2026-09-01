export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const showInactive = query.showInactive === 'true'
  const search = query.search as string | undefined

  const data = await prisma.user.findMany({
    where: {
      role: { in: ['GURU', 'PETUGAS_PIKET'] },
      ...(showInactive ? { isActive: false } : { isActive: true }),
      ...(search && { nama: { contains: search } })
    },
    select: {
      id: true,
      nama: true,
      email: true,
      nip: true,
      nomorHp1: true,
      nomorHp2: true,
      jenisKelamin: true,
      foto: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          kelasWali: true
        }
      }
    }
  })

  return data.sort((a, b) => a.nama.length - b.nama.length || a.nama.localeCompare(b.nama))
})
