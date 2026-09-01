import { updateGuruSchema } from './schema'

export default defineEventHandler(async (event) => {
  const id = parseInt(getRouterParam(event, 'id')!)
  if (isNaN(id)) throw createError({ statusCode: 400, statusMessage: 'ID tidak valid' })

  const body = await readBody(event)
  const result = updateGuruSchema.safeParse(body)
  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: result.error.issues[0].message
    })
  }

  const existing = await prisma.user.findFirst({
    where: { id, role: { in: ['GURU', 'PETUGAS_PIKET'] } }
  })
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Guru tidak ditemukan' })

  const { nama, email, nip, nomorHp1, nomorHp2, jenisKelamin, isActive } = result.data

  if (email && email !== existing.email) {
    const emailExists = await prisma.user.findUnique({
      where: { email }
    })
    if (emailExists) {
      throw createError({
        statusCode: 409,
        statusMessage: `Email "${email}" sudah digunakan`
      })
    }
  }

  if (nip !== undefined && nip !== existing.nip) {
    if (nip) {
      const nipExists = await prisma.user.findUnique({
        where: { nip }
      })
      if (nipExists) {
        throw createError({
          statusCode: 409,
          statusMessage: `NIP "${nip}" sudah digunakan`
        })
      }
    }
  }

  const updated = await prisma.user.update({
    where: { id },
    data: {
      ...(nama !== undefined && { nama }),
      ...(email !== undefined && { email }),
      ...(nip !== undefined && { nip: nip || null }),
      ...(nomorHp1 !== undefined && { nomorHp1: nomorHp1 || null }),
      ...(nomorHp2 !== undefined && { nomorHp2: nomorHp2 || null }),
      ...(jenisKelamin !== undefined && { jenisKelamin: jenisKelamin ?? null }),
      ...(isActive !== undefined && { isActive })
    },
    select: {
      id: true,
      nama: true,
      email: true,
      nip: true,
      isActive: true,
      updatedAt: true
    }
  })

  return updated
})
